-- Lets a calendar note span multiple days instead of just one.

alter table calendar_notes add column end_date date;
update calendar_notes set end_date = note_date where end_date is null;
alter table calendar_notes alter column end_date set not null;
alter table calendar_notes add constraint calendar_notes_end_after_start check (end_date >= note_date);

create index idx_calendar_notes_end_date on calendar_notes (end_date);
