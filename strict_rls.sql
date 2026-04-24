-- 1. Helper Function to Check Roles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Policy for ORDERS table
-- Allow Admins/Cashiers full access
-- Allow Waiters to View/Modify Only if they are the creator OR the assigned waiter, OR if the order is new (no waiter yet)
-- But stricter: If order exists and waiter_id is NOT current user, and user is WAITER, deny.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict Order Access" ON public.orders;

CREATE POLICY "Strict Order Access" ON public.orders
FOR ALL
USING (
  (public.get_user_role() IN ('ADMIN', 'CAJERO')) 
  OR
  (
    (public.get_user_role() = 'MESERO') 
    AND (
       waiter_id IS NULL -- Can take empty orders
       OR waiter_id = auth.uid() -- Can access own orders
    )
  )
);

-- Note: The logic "waiter_id IS NULL" allows waiters to grab an unassigned order.
-- Once assigned, only that waiter (or admin/cajero) can see/touch it.
