-- Documents the existing use_joker() RPC, which was created directly via the
-- SQL editor and had no corresponding migration file (schema drift). This is
-- a verbatim CREATE OR REPLACE of the live function definition -- no
-- behavioral change.
CREATE OR REPLACE FUNCTION public.use_joker()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  update public.profiles
  set joker_balance = joker_balance - 1
  where id = auth.uid()
  and joker_balance > 0;

  if found then
    return true;
  else
    return false;
  end if;
end;
$function$
;
