import { Compass } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store/index'
import { useTranslate } from '@/i18n/use-translate'

/** The gallery only lived in the native Help menu; the sidebar's Help menu opens it too. */
export function ZotzExploreMenuItem(): React.JSX.Element {
  const t = useTranslate()
  const openModal = useAppStore((s) => s.openModal)
  return (
    <DropdownMenuItem onSelect={() => openModal('feature-wall', { source: 'help_menu' })}>
      <Compass className="size-3.5" />
      {t('zotz.tours.helpMenu.explore', 'Explore Zotz')}
    </DropdownMenuItem>
  )
}
