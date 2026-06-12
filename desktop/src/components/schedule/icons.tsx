import { Power, Moon, RotateCcw, Sunrise, type LucideIcon } from 'lucide-react'

export function actionIcon(action: string): LucideIcon {
  if (action.startsWith('wake')) return Sunrise
  if (action === 'sleep') return Moon
  if (action === 'restart') return RotateCcw
  return Power
}
