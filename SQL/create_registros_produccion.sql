CREATE TABLE IF NOT EXISTS registros_produccion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platillo_id UUID REFERENCES products(id), -- Note: The prompt said 'platillos' but looking at other files it might be 'products'
  platillo_nombre TEXT,
  usuario_id UUID REFERENCES profiles(id), -- Note: The prompt said 'usuarios' but looking at other files it might be 'profiles'
  usuario_nombre TEXT,
  tiempo_inicio TIMESTAMPTZ,
  tiempo_fin TIMESTAMPTZ,
  duracion_segundos INTEGER,
  sucursal_id UUID,
  fecha TIMESTAMPTZ DEFAULT now()
);
