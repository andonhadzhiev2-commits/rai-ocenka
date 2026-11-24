-- Optional editable coordinates per table; existing QR tokens remain unchanged.
ALTER TABLE tables ADD COLUMN IF NOT EXISTS map_x numeric(5,2);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS map_y numeric(5,2);
