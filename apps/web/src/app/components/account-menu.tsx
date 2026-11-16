import { Avatar, Button } from '@crazy-staff/ui'
import { Link, useRouter } from '@tanstack/react-router'
import { LayoutDashboard, LogIn, LogOut, Settings, UserRound } from 'lucide-react'
import { signOut } from '@/lib/client/auth-client'
import { useSessionContext, useUserRole } from '@/lib/client/hooks/use-root-context'
import { isTeamMember } from '@/lib/shared/roles'
import { openSignIn } from './auth/auth-dialog'
import { useMe } from '../lib/idea-act'
import { m } from '../paraglide/messages.js'
import { AdaptiveMenu } from './adaptive'

/**
 * Top right of the panel: "Sign in" for visitors (opens the sign-in dialog on this page, `?auth=signin`),
 * the account menu once signed in.
 */
export function AccountMenu() {
  const session = useSessionContext()
  const role = useUserRole()
  const router = useRouter()
  const user = session?.user
  const me = useMe()

  if (!user) {
    return (
      <Button
        size="sm"
        variant="outline"
        nativeButton={false}
        render={<Link to="." search={openSignIn} />}
      >
        <LogIn /> {m.sign_in()}
      </Button>
    )
  }

  const name = user.name || user.email
  return (
    <AdaptiveMenu
      title={m.account_menu()}
      className="min-w-56"
      trigger={
        <Button
          variant="ghost"
          size="sm"
          // on a phone only the avatar shows: a square button around it
          className="gap-2 ps-1 max-sm:size-8 max-sm:justify-center max-sm:p-0"
          aria-label={m.account_menu()}
        >
          <Avatar size="sm" className="size-6" src={user.image ?? undefined} name={name} />
          <span className="max-w-40 truncate max-sm:hidden">{name}</span>
        </Button>
      }
      header={
        <div className="flex items-center gap-3 px-2.5 pt-2 pb-3">
          <Avatar size="sm" src={user.image ?? undefined} name={name} />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs text-muted">{user.email}</div>
          </div>
        </div>
      }
      entries={[
        ...(me
          ? [
              {
                label: m.profile_mine(),
                icon: <UserRound />,
                separated: true,
                render: <Link to="/u/$principalId" params={{ principalId: me.principalId }} />,
              },
            ]
          : []),
        {
          label: m.settings_title(),
          icon: <Settings />,
          separated: !me,
          render: <Link to="/settings/profile" />,
        },
        ...(isTeamMember(role)
          ? [
              {
                label: m.nav_admin(),
                icon: <LayoutDashboard />,
                separated: true,
                render: <Link to="/admin" />,
              },
            ]
          : []),
        {
          label: m.sign_out(),
          icon: <LogOut />,
          danger: true,
          separated: true,
          onSelect: async () => {
            await signOut().catch(() => {})
            await router.invalidate()
          },
        },
      ]}
    />
  )
}
