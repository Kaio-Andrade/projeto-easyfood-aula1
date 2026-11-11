DO $$
DECLARE
    user_count INTEGER;
    restaurant_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM "User";
    SELECT COUNT(*) INTO restaurant_count FROM "Restaurant";
    IF restaurant_count > 0 AND user_count <> 1 THEN
        RAISE EXCEPTION 'Há restaurantes existentes e % usuários; edite esta migration para adicionar ownerId nullable, preenchê-lo com um mapeamento explícito e então exigir NOT NULL', user_count;
    END IF;
END $$;

ALTER TABLE "Restaurant" ADD COLUMN "ownerId" INTEGER;

UPDATE "Restaurant"
SET "ownerId" = (SELECT MIN("id") FROM "User")
WHERE "ownerId" IS NULL;

ALTER TABLE "Restaurant" ALTER COLUMN "ownerId" SET NOT NULL;

ALTER TABLE "Dish" ADD COLUMN "category" VARCHAR(100) NOT NULL DEFAULT 'Geral';
ALTER TABLE "Dish" ALTER COLUMN "category" DROP DEFAULT;

CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Restaurant"
ADD CONSTRAINT "Restaurant_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
