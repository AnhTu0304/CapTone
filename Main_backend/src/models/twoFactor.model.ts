import { pool } from '../config/database';

export interface IBackupCodeItem {
    codeHash: string;
    used: boolean;
    used_at?: string | null;
}

export interface IUserTwoFactor {
    id: string;
    user_id: string;
    secret_key: string;
    is_enabled: boolean;
    backup_codes: IBackupCodeItem[];
    confirmed_at: Date | null;
    created_at: Date;
    updated_at: Date;
}

export class TwoFactorModel {
    public static async findByUserId(userId: string): Promise<IUserTwoFactor | null> {
        const query = `
            SELECT id, user_id, secret_key, is_enabled, backup_codes, confirmed_at, created_at, updated_at
            FROM user_two_factor
            WHERE user_id = $1
            LIMIT 1;
        `;
        const { rows } = await pool.query(query, [userId]);
        if (rows.length === 0) return null;

        const row = rows[0];
        return {
            id: row.id,
            user_id: row.user_id,
            secret_key: row.secret_key,
            is_enabled: Boolean(row.is_enabled),
            backup_codes: Array.isArray(row.backup_codes) ? row.backup_codes : [],
            confirmed_at: row.confirmed_at ? new Date(row.confirmed_at) : null,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at),
        };
    }

    public static async upsertSecret(
        userId: string,
        secretKey: string,
        backupCodes: IBackupCodeItem[]
    ): Promise<IUserTwoFactor> {
        const query = `
            INSERT INTO user_two_factor (user_id, secret_key, is_enabled, backup_codes, updated_at)
            VALUES ($1, $2, FALSE, $3::jsonb, NOW())
            ON CONFLICT (user_id) DO UPDATE
            SET secret_key = EXCLUDED.secret_key,
                is_enabled = FALSE,
                backup_codes = EXCLUDED.backup_codes,
                confirmed_at = NULL,
                updated_at = NOW()
            RETURNING id, user_id, secret_key, is_enabled, backup_codes, confirmed_at, created_at, updated_at;
        `;
        const { rows } = await pool.query(query, [userId, secretKey, JSON.stringify(backupCodes)]);
        const row = rows[0];
        return {
            id: row.id,
            user_id: row.user_id,
            secret_key: row.secret_key,
            is_enabled: Boolean(row.is_enabled),
            backup_codes: Array.isArray(row.backup_codes) ? row.backup_codes : [],
            confirmed_at: row.confirmed_at ? new Date(row.confirmed_at) : null,
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at),
        };
    }

    public static async enable(userId: string): Promise<boolean> {
        const query = `
            UPDATE user_two_factor
            SET is_enabled = TRUE, confirmed_at = NOW(), updated_at = NOW()
            WHERE user_id = $1;
        `;
        const result = await pool.query(query, [userId]);
        return (result.rowCount ?? 0) > 0;
    }

    public static async disable(userId: string): Promise<boolean> {
        const query = `
            DELETE FROM user_two_factor
            WHERE user_id = $1;
        `;
        const result = await pool.query(query, [userId]);
        return (result.rowCount ?? 0) > 0;
    }

    public static async updateBackupCodes(userId: string, backupCodes: IBackupCodeItem[]): Promise<boolean> {
        const query = `
            UPDATE user_two_factor
            SET backup_codes = $2::jsonb, updated_at = NOW()
            WHERE user_id = $1;
        `;
        const result = await pool.query(query, [userId, JSON.stringify(backupCodes)]);
        return (result.rowCount ?? 0) > 0;
    }
}
