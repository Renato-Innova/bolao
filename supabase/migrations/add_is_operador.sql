-- Adiciona perfil de operador: pode ativar palpites, sem acesso ao admin
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_operador boolean NOT NULL DEFAULT false;

-- Marca Ricardo como operador
UPDATE users SET is_operador = true WHERE email = 'ricardolcp@hotmail.com';
