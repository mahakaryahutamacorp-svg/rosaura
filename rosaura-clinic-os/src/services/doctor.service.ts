import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ServiceError } from "@/lib/errors";
import type { AppUser } from "@/lib/access";
import { canManageDoctors } from "@/lib/access";
import { writeAudit } from "@/services/audit";

export const DOCTOR_POSITION = "Dokter";
const DOCTOR_CODE_PREFIX = "DOK";
const PASSWORD_HASH_ROUNDS = 10;
const DOCTOR_ROLE = "CLINICAL";
const OWNER_ROLE = "OWNER";

const nameSchema = z.string().trim().min(3, "Nama dokter minimal 3 huruf").max(120, "Nama dokter terlalu panjang");
const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(190, "Email terlalu panjang")
  .pipe(z.email("Format email tidak valid"));
const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine((value) => value === "" || /^(\+62|0)\d{8,14}$/.test(value), "Nomor telepon diawali 0 atau +62 dan berisi angka");
const passwordSchema = z
  .string()
  .min(8, "Kata sandi minimal 8 karakter")
  .max(72, "Kata sandi maksimal 72 karakter");

const createSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  grantOwner: z.boolean(),
});

const updateSchema = z.object({
  employeeId: z.string().min(1),
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: z.union([z.literal(""), passwordSchema]),
  grantOwner: z.boolean(),
  isActive: z.boolean(),
});

export type CreateDoctorInput = z.input<typeof createSchema>;
export type UpdateDoctorInput = z.input<typeof updateSchema>;

const doctorInclude = {
  user: { select: { id: true, email: true, isActive: true } },
  roles: { include: { role: true } },
  _count: { select: { visits: true, assignments: true } },
} satisfies Prisma.EmployeeInclude;

export type DoctorRecord = Prisma.EmployeeGetPayload<{ include: typeof doctorInclude }>;

function assertManager(actor: AppUser) {
  if (!canManageDoctors(actor)) throw new ServiceError("Hanya owner yang dapat mengelola akun dokter");
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ServiceError(parsed.error.issues[0]?.message ?? "Data dokter tidak valid");
  return parsed.data;
}

function roleNamesOf(doctor: { roles: Array<{ role: { name: string } }> }) {
  return doctor.roles.map((item) => item.role.name);
}

async function assertEmailAvailable(db: Prisma.TransactionClient, email: string, exceptUserId?: string) {
  const owner = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (owner && owner.id !== exceptUserId) throw new ServiceError("Email ini sudah dipakai akun lain");
}

/** Melanjutkan nomor DOK tertinggi dengan format yang sama seperti akun lama (DOK-01, DOK-02, ...). */
async function nextDoctorCode(db: Prisma.TransactionClient) {
  const rows = await db.employee.findMany({
    where: { employeeCode: { startsWith: `${DOCTOR_CODE_PREFIX}-` } },
    select: { employeeCode: true },
  });
  const highest = rows.reduce((max, row) => {
    const number = Number(row.employeeCode.slice(DOCTOR_CODE_PREFIX.length + 1));
    return Number.isInteger(number) ? Math.max(max, number) : max;
  }, 0);
  for (let number = highest + 1; number < highest + 25; number += 1) {
    const code = `${DOCTOR_CODE_PREFIX}-${String(number).padStart(2, "0")}`;
    const taken = await db.employee.findUnique({ where: { employeeCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  return `${DOCTOR_CODE_PREFIX}-${Date.now().toString(36).toUpperCase()}`;
}

async function roleIds(db: Prisma.TransactionClient, names: string[]) {
  const rows = await Promise.all(
    names.map((name) => db.role.upsert({ where: { name }, update: {}, create: { name }, select: { id: true } })),
  );
  return rows.map((row) => row.id);
}

/** Klinik tidak boleh kehilangan owner aktif terakhir, karena hanya owner yang bisa mengatur akses. */
async function assertAnotherActiveOwner(db: Prisma.TransactionClient, employeeId: string) {
  const others = await db.employee.count({
    where: {
      id: { not: employeeId },
      isActive: true,
      user: { isActive: true },
      roles: { some: { role: { name: OWNER_ROLE } } },
    },
  });
  if (others === 0) throw new ServiceError("Harus tersisa minimal satu owner aktif");
}

async function findDoctorOrThrow(db: Prisma.TransactionClient, employeeId: string) {
  const doctor = await db.employee.findFirst({
    where: { id: employeeId, position: DOCTOR_POSITION },
    include: { user: true, roles: { include: { role: true } } },
  });
  if (!doctor?.user) throw new ServiceError("Akun dokter tidak ditemukan");
  return { ...doctor, user: doctor.user };
}

export async function listDoctors(actor: AppUser): Promise<DoctorRecord[]> {
  assertManager(actor);
  return prisma.employee.findMany({
    where: { position: DOCTOR_POSITION },
    include: doctorInclude,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function createDoctor(actor: AppUser, input: CreateDoctorInput) {
  assertManager(actor);
  const data = parseOrThrow(createSchema, input);
  const passwordHash = await bcrypt.hash(data.password, PASSWORD_HASH_ROUNDS);

  return prisma.$transaction(async (tx) => {
    await assertEmailAvailable(tx, data.email);
    const employeeCode = await nextDoctorCode(tx);
    const employee = await tx.employee.create({
      data: { employeeCode, name: data.name, phone: data.phone || null, position: DOCTOR_POSITION },
    });
    await tx.user.create({ data: { employeeId: employee.id, email: data.email, passwordHash } });
    const roles = data.grantOwner ? [DOCTOR_ROLE, OWNER_ROLE] : [DOCTOR_ROLE];
    await tx.employeeRole.createMany({
      data: (await roleIds(tx, roles)).map((roleId) => ({ employeeId: employee.id, roleId })),
    });
    await writeAudit(tx, actor.userId, "CREATE_DOCTOR", "employee", employee.id, `${employeeCode} · ${data.email}`);
    return employee;
  });
}

export async function updateDoctor(actor: AppUser, input: UpdateDoctorInput) {
  assertManager(actor);
  const data = parseOrThrow(updateSchema, input);
  const isSelf = actor.employeeId === data.employeeId;
  if (isSelf && !data.isActive) throw new ServiceError("Anda tidak dapat menonaktifkan akun sendiri");
  if (isSelf && !data.grantOwner) throw new ServiceError("Anda tidak dapat melepas peran owner dari akun sendiri");
  const passwordHash = data.password ? await bcrypt.hash(data.password, PASSWORD_HASH_ROUNDS) : null;

  return prisma.$transaction(async (tx) => {
    const doctor = await findDoctorOrThrow(tx, data.employeeId);
    const currentRoles = roleNamesOf(doctor);
    const wasActiveOwner = currentRoles.includes(OWNER_ROLE) && doctor.isActive && doctor.user.isActive;
    if (wasActiveOwner && (!data.grantOwner || !data.isActive)) await assertAnotherActiveOwner(tx, doctor.id);
    await assertEmailAvailable(tx, data.email, doctor.user.id);

    await tx.employee.update({
      where: { id: doctor.id },
      data: { name: data.name, phone: data.phone || null, isActive: data.isActive },
    });
    await tx.user.update({
      where: { id: doctor.user.id },
      data: { email: data.email, isActive: data.isActive, ...(passwordHash ? { passwordHash } : {}) },
    });

    const otherRoles = currentRoles.filter((role) => role !== DOCTOR_ROLE && role !== OWNER_ROLE);
    const nextRoles = [...otherRoles, DOCTOR_ROLE, ...(data.grantOwner ? [OWNER_ROLE] : [])];
    await tx.employeeRole.deleteMany({ where: { employeeId: doctor.id } });
    await tx.employeeRole.createMany({
      data: (await roleIds(tx, nextRoles)).map((roleId) => ({ employeeId: doctor.id, roleId })),
    });

    const changes = [
      data.isActive ? "aktif" : "nonaktif",
      nextRoles.join(", "),
      passwordHash ? "kata sandi diganti" : "",
    ].filter(Boolean);
    await writeAudit(tx, actor.userId, "UPDATE_DOCTOR", "employee", doctor.id, changes.join(" · "));
  });
}

/**
 * Akun yang sudah punya jejak (kunjungan, booking, pembayaran, rekam, audit,
 * dan lainnya) hanya dinonaktifkan agar riwayat klinik tetap utuh.
 */
export async function deleteDoctor(actor: AppUser, employeeId: string): Promise<"deleted" | "deactivated"> {
  assertManager(actor);
  if (actor.employeeId === employeeId) throw new ServiceError("Anda tidak dapat menghapus akun sendiri");

  return prisma.$transaction(async (tx) => {
    const doctor = await findDoctorOrThrow(tx, employeeId);
    if (roleNamesOf(doctor).includes(OWNER_ROLE)) await assertAnotherActiveOwner(tx, doctor.id);

    const userId = doctor.user.id;
    const history = await Promise.all([
      tx.visit.count({ where: { providerId: employeeId } }),
      tx.bookingAssignment.count({ where: { employeeId } }),
      tx.booking.count({ where: { createdById: userId } }),
      tx.bookingStatusHistory.count({ where: { changedById: userId } }),
      tx.visitNote.count({ where: { authorId: userId } }),
      tx.clinicalPhoto.count({ where: { createdById: userId } }),
      tx.payment.count({ where: { createdById: userId } }),
      tx.paymentReversal.count({ where: { createdById: userId } }),
      tx.stockMovement.count({ where: { createdById: userId } }),
      tx.dailyJournal.count({ where: { filledById: userId } }),
      tx.auditLog.count({ where: { actorUserId: userId } }),
    ]);

    if (history.some((count) => count > 0)) {
      await tx.employee.update({ where: { id: employeeId }, data: { isActive: false } });
      await tx.user.update({ where: { id: userId }, data: { isActive: false } });
      await writeAudit(tx, actor.userId, "DEACTIVATE_DOCTOR", "employee", employeeId, doctor.employeeCode);
      return "deactivated";
    }

    await tx.employeeRole.deleteMany({ where: { employeeId } });
    await tx.user.delete({ where: { id: userId } });
    await tx.employee.delete({ where: { id: employeeId } });
    await writeAudit(tx, actor.userId, "DELETE_DOCTOR", "employee", employeeId, doctor.employeeCode);
    return "deleted";
  });
}
