import { supabase } from '@/integrations/supabase/client';
import { db } from './offlineDB';

const SYNC_TABLES = [
  { local: 'sales', remote: 'sales' },
  { local: 'sale_items', remote: 'sale_items' },
  { local: 'cash_register_movements', remote: 'cash_register_movements' },
  { local: 'employee_work_sessions', remote: 'jornadas' },
] as const;

type SyncableTable = typeof SYNC_TABLES[number]['local'];

async function syncTable(localTable: SyncableTable, remoteTable: string): Promise<number> {
  const table = db.table(localTable);
  const unsynced = await table.where('synced').equals(0).toArray();

  let synced = 0;

  for (const record of unsynced) {
    try {
      const { synced: _synced, ...data } = record;
      const { error } = await supabase.from(remoteTable as any).upsert(data as any);

      if (!error) {
        await table.update(record.id, { synced: true } as any);
        synced++;
      } else {
        console.warn(`[offlineSync] Error syncing ${localTable}/${record.id}:`, error.message);
      }
    } catch (err) {
      console.warn(`[offlineSync] Exception syncing ${localTable}/${record.id}:`, err);
    }
  }

  return synced;
}

async function syncPendingQueue(): Promise<number> {
  const pending = await db.pending_sync.orderBy('created_at').toArray();
  let synced = 0;

  for (const record of pending) {
    try {
      let error: any = null;

      switch (record.operation) {
        case 'insert': {
          const res = await supabase.from(record.table_name as any).insert(record.data);
          error = res.error;
          break;
        }
        case 'update': {
          const { id, ...rest } = record.data;
          const res = await supabase.from(record.table_name as any).update(rest).eq('id', id);
          error = res.error;
          break;
        }
        case 'delete': {
          const res = await supabase.from(record.table_name as any).delete().eq('id', record.record_id);
          error = res.error;
          break;
        }
      }

      if (!error) {
        await db.pending_sync.delete(record.id);
        synced++;
      } else {
        console.warn(`[offlineSync] Pending op failed ${record.table_name}/${record.record_id}:`, error.message);
      }
    } catch (err) {
      console.warn(`[offlineSync] Pending op exception ${record.table_name}/${record.record_id}:`, err);
    }
  }

  return synced;
}

export async function syncPendingRecords(): Promise<{ total: number; errors: number }> {
  if (!navigator.onLine) {
    return { total: 0, errors: 0 };
  }

  let totalSynced = 0;

  // Sync flagged records in order
  for (const { local, remote } of SYNC_TABLES) {
    totalSynced += await syncTable(local, remote);
  }

  // Sync pending queue
  totalSynced += await syncPendingQueue();

  if (totalSynced > 0) {
    console.log(`[offlineSync] Synced ${totalSynced} records`);
  }

  return { total: totalSynced, errors: 0 };
}
