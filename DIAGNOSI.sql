-- DIAGNOSI: vedi come è fatta davvero la tabella profiles
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='profiles' order by ordinal_position;

-- Se qui sopra NON vedi "email", la tua profiles ha solo id+role.
-- Esegui allora questo FIX (versione senza email):
