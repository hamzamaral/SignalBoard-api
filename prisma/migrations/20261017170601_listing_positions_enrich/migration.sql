-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "application_methods" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "application_place" TEXT,
ADD COLUMN     "evaluation_notes" TEXT,
ADD COLUMN     "exam_at" TIMESTAMP(3),
ADD COLUMN     "exam_topics" TEXT,
ADD COLUMN     "general_requirements" TEXT,
ADD COLUMN     "required_documents" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "result_announce_at" TIMESTAMP(3),
ADD COLUMN     "special_requirements" TEXT;

-- AlterTable
ALTER TABLE "user_listings" ADD COLUMN     "position_id" UUID;

-- CreateTable
CREATE TABLE "listing_positions" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "sequence_no" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "title_norm" TEXT NOT NULL,
    "service_class" TEXT,
    "grade" INTEGER,
    "quota" INTEGER,
    "education_requirement" TEXT,
    "gender" TEXT,
    "kpss_score_type" TEXT,
    "kpss_min_score" DECIMAL(6,3),
    "skills_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_positions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_positions_listing_id_idx" ON "listing_positions"("listing_id");

-- CreateIndex
CREATE INDEX "listing_positions_title_norm_idx" ON "listing_positions"("title_norm");

-- AddForeignKey
ALTER TABLE "listing_positions" ADD CONSTRAINT "listing_positions_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_listings" ADD CONSTRAINT "user_listings_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "listing_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
