CREATE TABLE IF NOT EXISTS reviews (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  user_id integer NOT NULL,
  rating integer NOT NULL,
  title text,
  body text NOT NULL,
  pros jsonb NOT NULL DEFAULT '[]'::jsonb,
  cons jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommend boolean,
  verified_purchase boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  helpful integer NOT NULL DEFAULT 0,
  not_helpful integer NOT NULL DEFAULT 0,
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_product ON reviews (product_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_product ON reviews (user_id, product_id);

CREATE TABLE IF NOT EXISTS review_votes (
  id serial PRIMARY KEY,
  review_id integer NOT NULL,
  user_id integer NOT NULL,
  up boolean NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS review_vote_unique ON review_votes (review_id, user_id);

CREATE TABLE IF NOT EXISTS product_questions (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  user_id integer NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pq_product ON product_questions (product_id, status);

CREATE TABLE IF NOT EXISTS product_answers (
  id serial PRIMARY KEY,
  question_id integer NOT NULL,
  user_id integer NOT NULL,
  body text NOT NULL,
  role text NOT NULL DEFAULT 'customer',
  status text NOT NULL DEFAULT 'pending',
  helpful integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pa_question ON product_answers (question_id);
