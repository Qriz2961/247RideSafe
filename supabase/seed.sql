-- Starting fleet and Leyte tour packages. Run after the migration.
-- SAMPLE DATA: replace the plate numbers, rates and itineraries with Nole's
-- real ones (or edit them later in Supabase → Table Editor).

insert into public.units (plate_no, name, type, seats, transmission, fuel, daily_rate, with_driver_rate, self_drive_allowed, color, sort) values
  ('NBC 1234', 'Toyota Vios 2023',        'Sedan', 5,  'AT', 'Gas',    1800, 2800, true,  '#e2e8f0', 1),
  ('NDA 5678', 'Toyota Innova 2023',      'MPV',   7,  'AT', 'Diesel', 2800, 3800, true,  '#cbd5e1', 2),
  ('NFE 2468', 'Mitsubishi Xpander 2024', 'MPV',   7,  'AT', 'Gas',    2500, 3500, true,  '#fecaca', 3),
  ('NGH 1357', 'Toyota Fortuner 2022',    'SUV',   7,  'AT', 'Diesel', 3500, 4500, true,  '#1e293b', 4),
  ('NJK 9090', 'Toyota HiAce GL Grandia', 'Van',   12, 'AT', 'Diesel', 0,    5500, false, '#f1f5f9', 5),
  ('NLM 4321', 'Nissan Urvan NV350',      'Van',   15, 'MT', 'Diesel', 0,    5000, false, '#e5e7eb', 6);

insert into public.tours (name, type, base_price, max_pax, min_days, start_slots, itinerary, includes, sort) values
  ('Tacloban & Palo Heritage Day Tour', 'DAY_6H', 4500, 15, null, '{06:00,08:00,13:00}',
    '{"Santo Niño Shrine & Heritage Museum","San Juanico Bridge viewpoint","MacArthur Landing Memorial, Palo","Pasalubong stop (binagol, moron)"}',
    '{Driver,Fuel,Parking}', 1),
  ('Samar Side Trip Day Tour', 'DAY_6H', 5500, 15, null, '{05:00,07:00}',
    '{"Cross San Juanico Bridge","Basey, Samar","Lunch stop","Itinerary to confirm with Nole"}',
    '{Driver,Fuel,Tolls}', 2),
  ('Leyte Loop (Long-term Tour)', 'LONG_TERM', 6000, 15, 2, '{}',
    '{"Day 1: Ormoc & Lake Danao","Day 2: Palompon (Kalanggaman Island boat not included)","Day 3+: free itinerary with driver"}',
    '{"Driver","Fuel up to 200 km/day"}', 3);
