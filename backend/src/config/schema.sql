CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin','volunteer','parent','viewer');
CREATE TYPE event_status AS ENUM ('scheduled','active','completed','cancelled');

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  timezone VARCHAR(100) DEFAULT 'America/Chicago',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  name VARCHAR(200) NOT NULL,
  role user_role DEFAULT 'parent',
  pin_hash VARCHAR(255),
  qr_token VARCHAR(100) UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  phone_primary VARCHAR(20) NOT NULL,
  phone_secondary VARCHAR(20),
  email VARCHAR(255),
  qr_token VARCHAR(100) UNIQUE DEFAULT encode(gen_random_bytes(12),'hex'),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  checkin_count INTEGER DEFAULT 0,
  last_checkin_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_families_phone ON families(RIGHT(phone_primary,4));
CREATE INDEX idx_families_qr ON families(qr_token);
CREATE INDEX idx_families_org ON families(organization_id);

CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(200) GENERATED ALWAYS AS (first_name||' '||last_name)
cat > ~/Downloads/iglekids/backend/src/config/schema.sql << 'EOF'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin','volunteer','parent','viewer');
CREATE TYPE event_status AS ENUM ('scheduled','active','completed','cancelled');

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  timezone VARCHAR(100) DEFAULT 'America/Chicago',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20),
  name VARCHAR(200) NOT NULL,
  role user_role DEFAULT 'parent',
  pin_hash VARCHAR(255),
  qr_token VARCHAR(100) UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  phone_primary VARCHAR(20) NOT NULL,
  phone_secondary VARCHAR(20),
  email VARCHAR(255),
  qr_token VARCHAR(100) UNIQUE DEFAULT encode(gen_random_bytes(12),'hex'),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  checkin_count INTEGER DEFAULT 0,
  last_checkin_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_families_phone ON families(RIGHT(phone_primary,4));
CREATE INDEX idx_families_qr ON families(qr_token);
CREATE INDEX idx_families_org ON families(organization_id);

CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(200) GENERATED ALWAYS AS (first_name||' '||last_name) STORED,
  birthdate DATE NOT NULL,
  age_years INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM AGE(birthdate))::INTEGER) STORED,
  gender VARCHAR(20),
  has_allergies BOOLEAN DEFAULT FALSE,
  allergies TEXT[],
  medical_notes TEXT,
  special_needs TEXT,
  emergency_contact VARCHAR(200),
  emergency_phone VARCHAR(20),
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  checkin_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_children_family ON children(family_id);
CREATE INDEX idx_children_org ON children(organization_id);

CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(100) NOT NULL,
  room_number VARCHAR(20),
  min_age INTEGER,
  max_age INTEGER,
  capacity INTEGER DEFAULT 15,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id),
  name VARCHAR(200) NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status event_status DEFAULT 'scheduled',
  attendance_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_org ON events(organization_id,starts_at DESC);

CREATE TABLE checkins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id),
  family_id UUID NOT NULL REFERENCES families(id),
  child_id UUID NOT NULL REFERENCES children(id),
  classroom_id UUID REFERENCES classrooms(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  security_code VARCHAR(10) NOT NULL,
  checked_in_by UUID REFERENCES users(id),
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  checked_out_by UUID REFERENCES users(id),
  checked_out_at TIMESTAMPTZ,
  checkout_verified BOOLEAN DEFAULT FALSE,
  checkin_method VARCHAR(20) DEFAULT 'phone',
  notes TEXT,
  label_printed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id,child_id)
);

CREATE INDEX idx_checkins_event ON checkins(event_id);
CREATE INDEX idx_checkins_family ON checkins(family_id);
CREATE INDEX idx_checkins_code ON checkins(event_id,security_code);

CREATE TABLE security_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  event_type VARCHAR(50) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
