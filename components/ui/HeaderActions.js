'use client'
import Link from 'next/link'
import LanguageIcon from '@/components/ui/LanguageIcon'
import NotificationBell from '@/lib/NotificationBell'
import { IconUser } from '@/components/ui/Icons'

// Right side of a page header: language, then notifications, then (optionally) profile on the far right.
export default function HeaderActions({ profile = false }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <LanguageIcon />
      <NotificationBell />
      {profile && (
        <Link
          href="/profile"
          aria-label="Profile"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-mint text-emerald"
        >
          <IconUser size={20} />
        </Link>
      )}
    </div>
  )
}