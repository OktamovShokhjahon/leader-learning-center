'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { DoorOpen, Pencil, Trash2 } from 'lucide-react'
import { useQuery, useMutation, type Paginated } from '@/lib/api/use-api'
import { Panel, TableShell, Th, Td, Loading, ErrorBox, Empty } from './primitives'
import { NewButton, RowAction } from './table-kit'
import { Dialog, Field, INPUT, Action, DialogError, ConfirmDialog } from './form-kit'
import { cn } from '@/lib/utils'

type Room = { _id: string; name: string; capacity: number; equipment?: string[] }

/**
 * TZ §21.1 — "Rooms", and the other axis of the §9.3 schedule grid.
 *
 * A room existed as a model with no way to create one, so every group had to be
 * timetabled against an id somebody wrote into Mongo by hand. Rooms are
 * branch-scoped, so this list is already the current branch's — no filter needed.
 */
export function RoomsTable() {
  const t = useTranslations('panel.rooms')
  const [editing, setEditing] = useState<Room | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Room | null>(null)

  const { data, loading, error, refetch } = useQuery<Paginated<Room>>('/rooms?limit=100')
  const remove = useMutation<undefined, unknown>(() => `/rooms/${deleting?._id ?? ''}`, 'DELETE')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-sm text-ink dark:text-white">{t('title')}</h2>
        <NewButton label={t('create')} onClick={() => setEditing('new')} />
      </div>

      {loading ? <Loading /> : null}
      {error ? <ErrorBox code={error.code} message={error.message} /> : null}
      {data && data.items.length === 0 ? <Empty title={t('none')} Icon={DoorOpen} /> : null}

      {data && data.items.length > 0 ? (
        <Panel>
          <TableShell>
            <thead>
              <tr>
                <Th>{t('name')}</Th>
                <Th className="text-right">{t('capacity')}</Th>
                <Th>{t('equipment')}</Th>
                <Th className="text-right" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((room) => (
                <tr key={room._id} className="hover:bg-navy-50/50 dark:hover:bg-navy-800/40">
                  <Td className="font-medium text-ink dark:text-white">{room.name}</Td>
                  <Td className="text-right font-mono tabular-nums">{room.capacity}</Td>
                  <Td className="text-2xs text-ink-muted">
                    {room.equipment?.length ? room.equipment.join(' · ') : '—'}
                  </Td>
                  <Td className="text-right">
                    <span className="flex justify-end gap-2">
                      <RowAction label={t('edit')} Icon={Pencil} onClick={() => setEditing(room)} />
                      <RowAction
                        label={t('delete')}
                        Icon={Trash2}
                        tone="danger"
                        onClick={() => setDeleting(room)}
                      />
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      ) : null}

      {editing ? (
        <RoomDialog
          room={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void refetch()
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={t('deleteTitle')}
          body={t('deleteBody', { name: deleting.name })}
          confirmLabel={t('delete')}
          pending={remove.pending}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            const result = await remove.mutate()
            if (result !== null) {
              setDeleting(null)
              void refetch()
            }
          }}
        />
      ) : null}
    </div>
  )
}

function RoomDialog({
  room,
  onClose,
  onSaved,
}: {
  room: Room | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations('panel.rooms')
  const creating = room === null

  const [name, setName] = useState(room?.name ?? '')
  const [capacity, setCapacity] = useState(room?.capacity ?? 12)
  const [equipment, setEquipment] = useState((room?.equipment ?? []).join(', '))

  const save = useMutation<Record<string, unknown>, Room>(
    creating ? '/rooms' : `/rooms/${room._id}`,
    creating ? 'POST' : 'PATCH',
  )

  return (
    <Dialog title={creating ? t('create') : name} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label={t('name')} required>
          <input
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            className={INPUT}
          />
        </Field>

        <Field label={t('capacity')}>
          <input
            type="number"
            min={1}
            max={200}
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
            className={INPUT}
          />
        </Field>

        <Field label={t('equipment')} hint={t('equipmentHint')}>
          <input
            value={equipment}
            onChange={(event) => setEquipment(event.target.value)}
            className={cn(INPUT)}
          />
        </Field>

        {save.error ? <DialogError error={save.error} /> : null}

        <Action
          label={creating ? t('create') : t('save')}
          tone="primary"
          pending={save.pending}
          disabled={name.trim().length === 0}
          onClick={async () => {
            const result = await save.mutate({
              name: name.trim(),
              capacity,
              equipment: equipment
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
            })
            if (result) onSaved()
          }}
        />
      </div>
    </Dialog>
  )
}
