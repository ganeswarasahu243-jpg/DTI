const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
    process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listAllUsers() {
    const users = [];
    let page = 1;
    const perPage = 200;

    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });

        if (error) {
            throw error;
        }

        const chunk = data?.users || [];
        users.push(...chunk);

        if (chunk.length < perPage) {
            break;
        }

        page += 1;
    }

    return users;
}

function isEmailPasswordAccount(user) {
    const emailProvider = user?.identities?.some((identity) => identity?.provider === 'email');
    return Boolean(user?.email && emailProvider);
}

async function main() {
    const users = await listAllUsers();
    const targets = users.filter(isEmailPasswordAccount);

    if (!targets.length) {
        console.log('No email/password auth users found to delete.');
        return;
    }

    console.log(`Found ${targets.length} email/password auth user(s).`);

    if (dryRun) {
        for (const user of targets) {
            console.log(`DRY RUN - would delete: ${user.id} (${user.email})`);
        }
        return;
    }

    for (const user of targets) {
        const { error } = await supabase.auth.admin.deleteUser(user.id, false);
        if (error) {
            throw new Error(`Failed deleting ${user.email || user.id}: ${error.message}`);
        }
        console.log(`Deleted: ${user.id} (${user.email})`);
    }

    console.log(`Deleted ${targets.length} email/password auth user(s).`);
}

main().catch((error) => {
    console.error('Cleanup failed:', error.message || error);
    process.exit(1);
});
