import { redirect } from "next/navigation";
import { updateEmployeeAction } from "@/app/actions/operations";
import { Flash } from "@/components/Flash";
import { isOwner, requireUser } from "@/lib/access";
import { roleLabel } from "@/lib/labels";
import { primaryButton } from "@/lib/styles";
import { listEmployees } from "@/services/employee.service";

const roles = ["OWNER", "FRONT_OFFICE", "CLINICAL", "WAREHOUSE"];

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!isOwner(user)) redirect("/dashboard");
  const employees = await listEmployees();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Karyawan</h1>
        <p className="text-sm text-muted">Satu orang boleh memegang lebih dari satu peran. Akun nonaktif tidak bisa masuk.</p>
      </div>
      <Flash error={params.error} notice={params.notice} />
      <div className="grid gap-4">
        {employees.map((employee) => {
          const assigned = new Set(employee.roles.map((item) => item.role.name));
          return (
            <form key={employee.id} action={updateEmployeeAction} className="rounded-3xl border border-line bg-paper p-5">
              <input type="hidden" name="employeeId" value={employee.id} />
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{employee.name}</h2>
                  <p className="text-sm text-muted">
                    {employee.employeeCode} · {employee.position} · {employee.user?.email}
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isActive" defaultChecked={employee.isActive && employee.user?.isActive} />
                  Aktif
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                {roles.map((role) => (
                  <label key={role} className="flex items-center gap-2">
                    <input type="checkbox" name="roles" value={role} defaultChecked={assigned.has(role)} />
                    {roleLabel[role]}
                  </label>
                ))}
              </div>
              <button className={`${primaryButton} mt-4`} type="submit">
                Simpan akses
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
