// scripts/apply_rls_fix.mjs
// Mostra o SQL que precisa ser aplicado no Supabase Studio
import { readFileSync } from 'fs';

const sql = readFileSync('./migration_013_fix_rls.sql', 'utf-8');

console.log('📦 APLICAR MIGRATION NO SUPABASE DE PRODUÇÃO\n');
console.log('OPÇÃO 1 - Via Supabase Studio (recomendado):');
console.log('1. Acesse: https://innerworks-supabase-portal-inner.zvzr4n.easypanel.host');
console.log('2. Login: innerworks / Inner2026');
console.log('3. Vá em SQL Editor (menu lateral)');
console.log('4. Cole o SQL abaixo e clique em RUN\n');
console.log('═'.repeat(80));
console.log(sql);
console.log('═'.repeat(80));
console.log('\n✅ Após aplicar, reinicie o painelbackend para garantir que tudo está sincronizado.');