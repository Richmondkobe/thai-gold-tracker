-- Enables scheduling the fetch-prices Edge Function from inside Postgres,
-- replacing Vercel Cron (whose serverless IPs get Cloudflare-challenged by
-- goldtraders.or.th). The actual schedule (cron.schedule(...) call, which
-- embeds the CRON_SECRET) is run manually via the SQL editor, not committed
-- here, matching how other secrets in this project are handled.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
