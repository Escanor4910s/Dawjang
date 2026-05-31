const fs = require('fs');
let raw = fs.readFileSync('policies.json', 'utf8');

let startIndex = raw.indexOf('{');
if (startIndex !== -1) {
    raw = raw.substring(startIndex);
}

const data = JSON.parse(raw);
let sql = '-- Fix auth_rls_initplan warnings by wrapping auth functions in SELECT\n\n';

data.rows.forEach(p => {
    let q = p.qual ? p.qual.replace(/auth\.uid\(\)/g, '(select auth.uid())').replace(/auth\.jwt\(\)/g, '(select auth.jwt())') : null;
    let w = p.with_check ? p.with_check.replace(/auth\.uid\(\)/g, '(select auth.uid())').replace(/auth\.jwt\(\)/g, '(select auth.jwt())') : null;
    
    if (q) q = q.replace(/\(\s*select\s*\(\s*select\s*auth\.uid\(\)\s*\)\s*\)/g, '(select auth.uid())');
    if (w) w = w.replace(/\(\s*select\s*\(\s*select\s*auth\.uid\(\)\s*\)\s*\)/g, '(select auth.uid())');
    if (q) q = q.replace(/\(select \(\s*SELECT auth\.uid\(\) AS uid\)\)/gi, '(select auth.uid())');
    if (w) w = w.replace(/\(select \(\s*SELECT auth\.uid\(\) AS uid\)\)/gi, '(select auth.uid())');
    
    // Additional fixes for when it's already using a subselect like (( SELECT auth.uid() AS uid) = user_id)
    // We don't want to replace `auth.uid()` inside `( SELECT auth.uid() AS uid)` with `(select auth.uid())` which makes `( SELECT (select auth.uid()) AS uid)`
    // The replace above will result in `( SELECT (select auth.uid()) AS uid) = user_id)` which is harmless but ugly.
    
    if(q || w) {
        sql += `ALTER POLICY "${p.policyname}" ON "public"."${p.tablename}"`;
        if (q) sql += ` USING (${q})`;
        if (w) sql += ` WITH CHECK (${w})`;
        sql += ';\n';
    }
});

// Clean up duplicate selects
sql = sql.replace(/\(select \(select auth\.uid\(\)\)\)/gi, '(select auth.uid())');
sql = sql.replace(/\(select \(select auth\.jwt\(\)\)\)/gi, '(select auth.jwt())');
sql = sql.replace(/\(\s*SELECT \(select auth\.uid\(\)\) AS uid\)/gi, '(SELECT auth.uid())');

fs.writeFileSync('supabase/migrations/20260526170000_fix_rls_performance.sql', sql);
console.log('Done');
