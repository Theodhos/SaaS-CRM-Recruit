-- The organisation's own settings (pay defaults: currency, hours per day, days per month, fee %, days to pay).
ALTER TABLE "organisations" ADD COLUMN "settings" JSONB NOT NULL DEFAULT '{}';
