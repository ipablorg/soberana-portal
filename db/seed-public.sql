-- Soberana Network · Member Portal — public seed (markets; no counts, no weights)
-- Run THIRD. Seat totals and scoring weights are seeded ONLY by seed-private.sql.

insert into markets (code, name, rails, live, notes) values
  ('US', 'United States', array['ACH','Wire'],            true,  null),
  ('MX', 'Mexico',        array['SPEI'],                  true,  null),
  ('BR', 'Brazil',        array['PIX'],                   true,  null),
  ('CO', 'Colombia',      array['co-ACH','Bre-B'],        true,  null),
  ('EC', 'Ecuador',       array['SPI'],                   true,  null),
  ('PE', 'Peru',          array['Yape','PagoEfectivo'],   true,  'Yape/PagoEfectivo are payment services, not national rails; CCE provides interbank transfer infrastructure')
on conflict (code) do update
  set name = excluded.name, rails = excluded.rails, live = excluded.live, notes = excluded.notes;
