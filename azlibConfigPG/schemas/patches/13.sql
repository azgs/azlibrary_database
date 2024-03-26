CREATE TABLE IF NOT EXISTS public.lineage (
	lineage_id serial PRIMARY KEY,
	collection text REFERENCES public.collections(perm_id), 
	supersedes text unique references public.collections(perm_id)
);

INSERT INTO public.lineage (collection, supersedes)
    SELECT perm_id, supersedes FROM public.collections
    WHERE supersedes IS NOT NULL;

ALTER TABLE public.collections
    DROP COLUMN supersedes;

ALTER TABLE public.collections
    DROP COLUMN superseded_by;