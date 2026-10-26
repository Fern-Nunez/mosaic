import Link from "next/link"
import { ChevronRight, KeyRound, LayoutDashboard, LogOut } from "lucide-react"

import { signout } from "@/app/login/actions"
import { PAGE_TITLE } from "@/lib/app/ui"
import { NotificationSetting } from "@/components/app/notification-setting"
import { PhoneSetting } from "@/components/app/phone-setting"
import { SectionToggles } from "@/components/app/section-toggles"
import { ThemeToggle } from "@/components/app/theme-toggle"
import { createClient } from "@/lib/supabase/server"

const row =
  "flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] text-neutral-900 dark:text-neutral-100 active:bg-neutral-100 dark:active:bg-neutral-800"

export default async function MorePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className={`pt-4 ${PAGE_TITLE}`}>More</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{user?.email}</p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">Settings</h2>
        <div className="divide-y divide-neutral-200 overflow-hidden rounded-2xl bg-white dark:divide-neutral-800 dark:bg-neutral-900">
          <ThemeToggle className={`${row} cursor-pointer`} />
          {user && <PhoneSetting userId={user.id} />}
          <NotificationSetting rowClassName={row} />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-sm font-medium text-neutral-500 dark:text-neutral-400">Sections</h2>
        <div className="divide-y divide-neutral-200 overflow-hidden rounded-2xl bg-white dark:divide-neutral-800 dark:bg-neutral-900">
          <SectionToggles />
        </div>
        <p className="px-1 text-xs text-neutral-500 dark:text-neutral-400">
          Off hides it from Today, Trends and the + menu. Your data stays.
        </p>
      </section>

      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 overflow-hidden rounded-2xl bg-white dark:bg-neutral-900">
        {/* History, jobs etc. get added here as they're rebuilt. */}
        <Link href="/dashboard" className={row}>
          <LayoutDashboard className="size-5 text-neutral-500 dark:text-neutral-400" />
          <span className="flex-1">Old dashboard</span>
          <ChevronRight className="size-4 text-neutral-400 dark:text-neutral-500" />
        </Link>
        <Link href="/change-password" className={row}>
          <KeyRound className="size-5 text-neutral-500 dark:text-neutral-400" />
          <span className="flex-1">Change password</span>
          <ChevronRight className="size-4 text-neutral-400 dark:text-neutral-500" />
        </Link>
        <form action={signout}>
          <button type="submit" className={`${row} cursor-pointer text-red-600 dark:text-red-400`}>
            <LogOut className="size-5" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
