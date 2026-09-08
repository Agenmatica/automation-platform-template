import { AuthPage } from '@refinedev/mui'

// Sin registro ni "olvidé mi contraseña" propio: no existe ningún flujo de
// alta de cuenta salvo la invitación por email (spec 003, FR-009). Ver
// providers/authProvider.ts.
export function LoginPage() {
  return <AuthPage type="login" registerLink={false} forgotPasswordLink={false} />
}
