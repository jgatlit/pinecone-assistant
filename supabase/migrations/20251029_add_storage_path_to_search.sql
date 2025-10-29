-- Add storage_path to match_sbwc_document_sections return type
-- This enables generating signed URLs for PDF citations

CREATE OR REPLACE FUNCTION match_sbwc_document_sections(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.45,
  match_count INT DEFAULT 5,
  document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id BIGINT,
  document_id UUID,
  content TEXT,
  heading TEXT,
  similarity FLOAT,
  document_name TEXT,
  storage_path TEXT  -- Added for PDF URL generation
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ds.id,
    ds.document_id,
    ds.content,
    ds.heading,
    1 - (ds.embedding <=> query_embedding) AS similarity,
    d.name AS document_name,
    d.storage_path  -- Added storage_path from documents table
  FROM sbwc_document_sections ds
  JOIN sbwc_documents d ON ds.document_id = d.id
  WHERE
    1 - (ds.embedding <=> query_embedding) > match_threshold
    AND (
      document_ids IS NULL
      OR ds.document_id = ANY(document_ids)
    )
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
