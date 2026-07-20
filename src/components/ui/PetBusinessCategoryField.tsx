'use client'

import { PET_BUSINESS_CATEGORY_OPTIONS, getPetBusinessOtherDescription, parsePetBusinessCategories, setPetBusinessOtherDescription, togglePetBusinessCategory } from '@/lib/pet-business-categories'
import { cn } from '@/components/ui'

export default function PetBusinessCategoryField({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  const selected = parsePetBusinessCategories(value)
  const otherDescription = getPetBusinessOtherDescription(value)

  return (
    <div className={cn('space-y-2', className)}>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">Pet business categories</label>
      <div className="space-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
        {PET_BUSINESS_CATEGORY_OPTIONS.map(option => {
          const isChecked = selected.includes(option.value)
          return (
            <label key={option.value} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onChange(togglePetBusinessCategory(value, option.value))}
                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
              />
              <span className="text-sm text-slate-700 group-hover:text-slate-900">{option.label}</span>
            </label>
          )
        })}
      </div>
      {selected.includes('other') && (
        <input
          value={otherDescription}
          onChange={event => onChange(setPetBusinessOtherDescription(value, event.target.value))}
          placeholder="Specify the service (e.g. cat grooming services)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          aria-label="Other pet business service"
        />
      )}
      <p className="text-xs text-slate-400">Used by Competitor Analysis and other WS2 agents.</p>
    </div>
  )
}
