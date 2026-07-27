-- Lets a calendar note target multiple specific classes instead of just one
-- (or all, when null/empty).

alter table calendar_notes add column class_keys text[];
update calendar_notes set class_keys = case when class_key is null then null else array[class_key] end;
alter table calendar_notes drop column class_key;
