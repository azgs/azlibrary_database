CREATE SCHEMA dicts;

CREATE TABLE dicts.languages (
	language_id serial PRIMARY KEY,
    language_name text,
    iso639_2 text,
    iso639_3 text,
    iso639_1 text
);

CREATE TABLE dicts.arizona_places (
    arizona_place_id integer primary key,
    arizona_place_name text,
    name_formal text,
    placetype text,
    iso2 text,
    iso3 text,
    continent integer,
    country integer,
    region integer,
    county integer,
    locality integer,
    other_names hstore,
    geom geometry,
    within_arizona boolean
);

--COMMENT ON TABLE wof_arizona IS 'This is a subset of Macrostrats WOF database (from MapZen). It has all known localities within a 10° buffer of the state of arizona. Localities contained strictly within the state of Arizona are marked in the within_arizona field. This table is not 3rd normal order because the other_names field (foreign language names) is text string that must be parsed. The index for language acronyms is in the wof_languages table.';
DO
$do$
BEGIN
EXECUTE format($$COMMENT ON TABLE dicts.arizona_places IS 'This is a subset of Macrostrats WOF database (from MapZen). It has all known localities within a 10° buffer of the state of arizona. Localities contained strictly within the state of Arizona are marked in the within_arizona field. This table is not 3rd normal order because the other_names field (foreign language names) is text string that must be parsed. The index for language acronyms is in the wof_languages table.';
$$);
END
$do$;

CREATE INDEX arizona_places_geom_idx ON dicts.arizona_places USING gist (geom);

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE TABLE dicts.azgs_glossary (
    glossary_id serial PRIMARY KEY,
    term text UNIQUE,
    definition text,
    source_id uuid UNIQUE
);

insert into dicts.azgs_glossary (term, definition, source_id) values ('bedding','Layering produced by stratification; the accumulation of sediment into layers, known as strata, whose characteristics are defined principally by variations in the strength and sediment-carrying (bed load) capacity of the depositing medium.','74f938ce-a703-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('contact, depositional','A sedimentary rock or lava flow was deposited under an older rock.','9f1cf262-a703-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('dike','A sheet-like body of intrusive igneous rock that cuts across bedding or foliation (if present) in host rock. Dike is also a kind of degenerate volume geologic surface.','b1f1cd18-a703-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('apparent dip','The plunge  of the line created by the intersection of the measured planar feature with a hypothetical vertical plane conicdent with and parallel to the symbol''s arrow on the map.','dea4ca54-a703-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('earth surface description boundary trace','Genetic boundary trace represents the outcrop of the surface separating two mapped bodies of rock that was formed during the genesis of at least one of the geologic units. Identity of a genetic boundary trace is defined by the two geologic units that are separated. A genetic boundary trace is the 2-D map manifestation of a geologic surface.','260ff012-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('bedding, contorted or variable','Layering produced by stratification; the accumulation of sediment into layers, known as strata that are strongly undulatory.','260ffaee-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('cleavage, parallel to bedding','Composite fabric in which a cleavage is developed parallel to bedding.','a93ba6e8-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('contact, intrusive','Contact between a host rock body and a magmatic intrusion.','a93bc5ba-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('contact, intrusive, timing unknown','Contact at which an igneous rock has intruded an older rock body; timing relationship across the contact not specified.','a93bc1b4-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('contact, depostional, unspecified conformity','Contact at which a sedimentary or volcanic rock has been deposited on another rock body.','ebe6a786-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('dike, felsic','Dike in which the intrusive rock body has a felsic composition.','f5a5b8ac-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation, directed stretching','Stretching  lineation for which the sense of shear relative to a containing foliation is known.','27b10fc2-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fault, detachment','A style of low-angle, high extension normal faulting.','27b118a0-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('cleavage, axial plane','A type of foliation where rock splits parallel to the cleavage surfaces.','a93baec2-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fault, high angle','High-angle fault for which hanging wall rocks are at a lower elevation than corresponding footwall rocks. Use when separation is indicated by markers of a nature that do not indicate lateral separation, e.g. a gently ','4a3fe450-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('contact, gradational','A gradual or continuous lithologic change from one geologic map unit to another.','a93bc3c6-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fault contact','Line depicting the trace of a mapped fault.','27b115a8-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fault','A discrete surface tectonic structure across which bodies of rock have been displaced relative to each other.','1f0306ec-a718-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('cleavage, slaty','Schistosity in which the individual grains defining the fabric are too small to be seen by the unaided eye. Continuous planar foliation defined by aligned fine to very-fine grained phyllosilicate mineral grains.','a93bb1ba-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('bedding, inclined','Lyering produced by stratification that is not parallel to the Earth''s surface.','26101416-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('compound tectonic foliation','Foliation defined by parting surfaces (cleavage domains) that  have no apparent thickness, are spaced between 5 cm and 25 cm, and do not crenulate an older foliation. Fabric intermediate between typical cleavage and joints. Parting surfaces are regularly spaced, and penetrative on a 1 to 10 m scale. 5 cm upper limit on spacing of cleavage.','a93bbef8-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('close joints','Foliation defined by parting surfaces (cleavage domains) that  have no apparent thickness, are spaced between 5 cm and 25 cm, and do not crenulate an older foliation. Fabric intermediate between typical cleavage and joints. Parting surfaces are regularly spaced, and penetrative on a 1 to 10 m scale. 5 cm upper limit on spacing of cleavage.','a93bba0c-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('cleavage, crenulation','Cleavage that is overprinted on an older foliation that is folded to some degree in association with development of the  younger cleavage.','bc1a3a04-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('CW asymmetric fold','Asymmetric fold for which the axial surface makes an acute dihedral angle measured counter clockwise from the imaginary surface that contains the inflection points for the folded surfaces or lines.','ebe66078-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('CCW asymmetric fold','Asymmetric fold for which the axial surface makes an acute dihedral angle measured clockwise from the imaginary surface that contains the inflection points for the folded surfaces or lines, when viewed in a profile normal to the hinge line of the fold.','26101632-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, flow','Foliation interpreted to be due to flow in a body of magma or lava. Includes flow banding in lava, and foliation defined by aligned crystals in a phaneritic igneous rock.','4a3fe5ea-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fold hinge','Linear structure defined by the locus of maximum curvature of a folded surface.','b61dacb6-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, primary igneous','Penetrative planar fabric interpreted to be the product of igneous processes, formed in the rock while melt was still present.','b61db5ee-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, protomylonitic, weak','Protomylonite foliation defined by shape of deformed, originally equant grains, in which aspect ratio of deformed grains is generally less than 3 to 1 (longest to shortest axis). Incipient mylonitic foliation, in which the planar aspect of the foliation i','e0f0506a-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation, tectonic','Fabric defined by aligned elongate (prolate) fabric elements for which the alignment is due to tectonic processes (i.e. post depositional for sedimentary rocks, post crystallization for igneous rocks, or any lineation related to metamorphism).','e0f056b4-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('groove or striae in surface','Lineation in which fabric elements are grooves or striations in a surface. Fabric elements may be locally penetrative within the surface, but absent in adjacent rock body.','0490af10-a706-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('joint','Parting surfaces in rock that occur in crudely parallel orientation, spaced greater than5 cm on average if in a very regular joint set. Spacing is more variable and alignment of surfaces is cruder that cleavage.','2c638d6e-a706-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lithogenetic boundary','A non-faulted contact separating bodies of material in the earth that have different lithologic character or geologic history.','610981fe-a706-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fault, low angle, normal','Low-angle fault with normal separation or slip.','6109851e-a706-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('map boundary','Delineation of map area','6109892e-a706-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation, mineral','Lineation defined by alignment of elongate crystals that have a prismatic crystal habit or of monomineralic grain aggregates.','61098ac8-a706-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('mylonite seam','High-strain seam in which the deformed rock within the seam is mylonitic rock.','18b57c22-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('orientation, discrete surface','Measurement of orientation of a single surface (discrete structure) at a point location.','18b6cd5c-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('paleocurrent','Observation result that is vector indicating direction of sediment transport recorded in a sedimentary deposit. Should have accompanying information indicating the reference frame for the orientation.','30444814-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('scratch boundary surface','Boundary with unknown location, that must exist, so location is guessed.','7f31a5ca-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('slickenline','Refers to the liner scratches which occur on a surface when two rock bodies rub past one another.','7f31aa48-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation, stretching','Lineation defined by elongate (prolate) fabric elements in which the alignment of the fabric elements, and the formation of prolate fabric elements, is interpreted to be the product of crystal plastic deformation processes.','955499b6-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('surface trace trend','The azimuth of the surface trace of a geologic surface, essentially a line with apparent dip of 0.','a1f6cfb8-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, protomylonitic, well-developed','Protomylonite foliation defined by aligned  tectonically flattened mineral grains, and planar or tabular grains rotated to parallel foliation, as well as cleavage along slip or shear surfaces. ','e0f05452-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fault, thrust','Low-angle fault with a hanging wall displaced from a structurally deeper position relative to footwall rocks.','f8349bf8-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('layering, transposed bedding','Layering interpreted to have originated as sedimentary bedding that has been transposed as a result of metamorphism and deformation.','09d4d5a8-a708-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('vein','Degenerate volume that is a sheet-like body of hydrothermally deposited mineral material.','147beef6-a708-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('vein mineral fill','Vein formed by a solid mineral fill (like a dike).','1f1232b2-a708-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fault zone','An area where there are several closely spaced faults.','4a3fe0c2-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation, intersection Sn-Sn+1','Lineation defined by the intersection of two tectonic foliations.','0a405238-a717-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('error','A mistake.','0a405b3e-a717-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('trend of oriented inclusion','Symbol depicting the azimuthal orienation of an elongate inclusion.','0a405fbc-a717-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('laminated tectonic layering','Tectonic layering in which the layers are less than 1 cm thick. See Weiss, L.E. [1972] plate 36 or Borraidaile et al [1982] plate 137A,B (page 331), plate140A (page 337)  for examples.','2c638ecc-a706-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('contact, intrusive, orientation','The orientation of an intrusive contact.','0a3fb6a2-a717-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation','Fabric defined by the planar arrangement of textural or structural features (fabric elements).','b61db224-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fold','Structure consisting of one or more curved layers, surfaces, or lines in a rock body, unified by continuous axial surface, and bounded by inflection points on limbs. ','4a3fe77a-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('schistosity','A  fabric defined the parallel, planar arrangement of mineral grains having a platy, lamellar, or tabular crystallographic habit that are oriented in a continuous planar or linear fabric. Note that the structure term schistosity refers to a planar fabric in this vocabulary, while the rock name schist may refer to a rock with well developed schistosity.','30444a8a-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('tectonic layering','Penetrative linear structure in a rock body defined by fabric elements that are the product of tectonic processes.','d9508f9e-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('tectonic foliation','Foliation  in a rock body defined by physical components related to deformation subsequent to solidification of the rock.','c4e3a64a-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('shear zone, unclassified','A sheet-like zone of distributed deformation, lacking an obvious discrete slip surface, across which bodies of rock have been displaced relative to each other. Boundaries are typically gradational at or near the scale of observation.','7f31a8cc-a707-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, gneissic, inclined','Layering in a geologic rock where the layers are of alternating mineral composition.','0a406f3e-a717-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fault, normal','A geologic fault in which the hanging wall has moved downward relative to the footwall. Normal faults occur where two blocks of rock are pulled apart, as by tension.','59276710-a717-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('vein or dike lithosome','A mass of rock of approximately uniform character penetrated by tongues of rock from adjacent masses with a different lithology.','0a4066ce-a717-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('hinge line','A straight or curved line which joins the points of maximum curvature along the hinge of a fold.','2c638a76-a706-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, protomylonitic','Mylonitic foliation in which 10 to 50 percent of rock is matrix due to tectonic grain size reduction processes. Planar aspect of fabric may be quite subtle in  weakly deformed rocks.','b61dbb5c-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('Earth surface geologic surface 3D intersection','The trace of a geological plane''s intersection with the earth''s surface','c761aac4-a7bc-11e8-ae4c-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, compositional layering','Layering in a geologic rock where the layers are of varying mineral composition.','5927633c-a717-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('parallel S0 and S1','Strike and dip of composite fabric produced by parallel bedding and foliation.','57dd6170-1373-11e9-b168-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fault, high-angle, normal','A high-angle fault with normal separation.','e646bbb6-ad6e-11e8-b6c3-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('bedding, overturned',null,'04e63db0-ad71-11e8-b6c3-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('Z-fold axis','Trend and plunge of axis of the z-shaped minor fold.','6fc8ca54-1373-11e9-b168-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('contact','Very general concept representing any kind of surface separating two geologic units.','17c80f44-a718-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('bedding, crude or indistinct','Layering produced by stratification.','26100606-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('axial surface synform','Axial surface for fold in which the concave side of the folded surfaces is on the top. Facing of folded surface not specified.','260ff792-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('cleavage','A planar tectonic foliation in a rock characterized by a tendency for the rock to split along a regular set of parallel or sub-parallel closely spaced surfaces.','c576530e-a703-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('cleavage, close disjunct','Spaced cleavage in sandstone or phyllosilicate-poor rock, defined by partings of uncertain origin, and does not crenulate an existing cleavage. (sometimes called fracture cleavage).','a93bb5ca-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('bedding, horizontal','Horizontal layering produced by stratification.','26101178-a704-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('bedding, upright',null,'c7f3fc96-ad73-11e8-b6c3-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('cumulate layering','Layering in igneous rocks in which layers are characterized by variation in relative proportion of magmatically crystallized minerals. Typically a pattern of mineralogical variation will be repeated many times in a vertical section with layers of relatively consistent thickness.','0c61a3f4-ad71-11e8-b6c3-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, preferred mica orientation',null,'bdb03a46-ad74-11e8-b6c3-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, eutaxitic','Foliation defined by flattened pumice clasts or glass shards and aligned elongate lithic fragments in a welded tuff. This term denotes interpretation that foliation formed during compaction and welding of tuff.','e9211ccc-ad74-11e8-b6c3-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, mylonitic','A fault rock which is cohesive and characterised by a well-developed schistosity resulting from tectonic reduction of grain size, and commonly containing rounded porphyroclasts and lithic fragments of similar composition to minerals in the matrix.','b61db86e-a705-11e8-a418-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation, mineral aggregate',null,'9e16e92c-ad75-11e8-b6c3-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('vein, quartz','Degenerate volume that is a sheet-like body of hydrothermally deposited quartz.','02de5fac-ad76-11e8-b6c3-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('not assigned','Not assigned.','c5295dac-b071-11e8-b057-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('trend orientation','A symbol depicting the azimuthal orientation of some elongate geological entity.','0a406322-a717-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('dike orientation','A symbol depicting the azimuthal orientation of a dike.','ecf0e514-b07e-11e8-b057-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('orientation, depositional contact','A symbol depicting the azimuthal orientation of a depositional contact.','2d9aa72e-b086-11e8-b1f3-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, gneissic, vertical','Layering in a geologic rock where the layers are of alternating mineral composition.','e783f6f4-a717-11e8-8094-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation, directed slickenline',null,'320e6b98-e762-11e8-b0da-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fault or vein orientation','The orientation of a fault or a vein.','8a346d76-e76d-11e8-bdb2-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('foliation, axial plane','The axial plane of a foliation.','95eeb1f8-104e-11e9-a006-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation, crenulation','A lineation defined by the hinges of small folds (crenulations) associated with crenulation cleavage.','fed065bc-104f-11e9-a3c5-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('fracture','A fracture is any separation in a geologic formation, such as a joint or a fault that divides the rock into two or more pieces.','0341b3b0-1052-11e9-ad6e-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation','A lineation is any linear feature or element in a rock , and can occur as the product of tectonic, mineralogical, sedimentary, or geomorphic processes.','f3bb5d32-1052-11e9-ad6e-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('schistosity (S2)','Strike and dip of second generation schistosity.','91861bb0-1373-11e9-b168-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('F2 Axes','Trend and plunge of axis of second phase fold.','9e01696c-1373-11e9-b168-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation, intersection','Lineation produced by the intersection of surfaces of two different generations.','6a252b9c-137d-11e9-b06b-a860b63863b5');
insert into dicts.azgs_glossary (term, definition, source_id) values ('lineation, intersection (L2)','Lineation produced by the intersection of first- and second-generation foliations.','6a257d04-137d-11e9-b06b-a860b63863b5');


alter table dicts.azgs_glossary alter column source_id set default uuid_generate_v1();



CREATE TABLE dicts.minerals
(
	mineral_id integer NOT NULL,
	mineral text,
	mineral_type text,
	formula text,
	formula_tags text,
	url text,
	CONSTRAINT minerals_pkey PRIMARY KEY (mineral_id)
);

CREATE TABLE dicts.lithologies
(
	lith_id integer NOT NULL,
	name text,
	type text,
	"group" text,
	class text,
	color text,
	fill integer,
	t_units integer,
	CONSTRAINT lithologies_pkey PRIMARY KEY (lith_id)
);

CREATE TABLE dicts.intervals
(
	int_id integer NOT NULL,
	name text,
	abbrev text,
	t_age double precision,
	b_age double precision,
	int_type text,
	timescales text,
	color text,
	CONSTRAINT intervals_pkey PRIMARY KEY (int_id)
);

CREATE TABLE dicts.lith_attr
(
	lith_att_id integer NOT NULL,
	name text,
	type text,
	t_units integer,
	CONSTRAINT lith_attr_pkey PRIMARY KEY (lith_att_id)
);

CREATE TABLE dicts.environments
(
	environ_id integer NOT NULL,
	name text,
	type text,
	class text,
	color text,
	t_units integer,
	CONSTRAINT environments_pkey PRIMARY KEY (environ_id)
);

CREATE TABLE dicts.grainsize
(
	grain_id integer NOT NULL,
	grain_symbol text,
	grain_name text,
	grain_group text,
	soil_group text,
	min_size double precision,
	max_size double precision,
	classification text,
	CONSTRAINT grainsize_pkey PRIMARY KEY (grain_id)
);

COPY dicts.minerals  FROM PROGRAM 'curl  "https://macrostrat.org/api/v2/defs/minerals?all&format=csv" | csvtool namedcol mineral_id,mineral,mineral_type,formula,formula_tags,url - ' WITH CSV HEADER;

COPY dicts.lithologies  FROM PROGRAM 'curl  "https://macrostrat.org/api/V2/defs/lithologies?all&format=csv" | csvtool namedcol lith_id,name,type,group,class,color,fill,t_units - ' WITH CSV HEADER;

COPY dicts.intervals  FROM PROGRAM 'curl  "https://macrostrat.org/api/V2/defs/intervals?all&format=csv" | csvtool namedcol int_id,name,abbrev,t_age,b_age,int_type,timescales,color - ' WITH CSV HEADER;

COPY dicts.lith_attr  FROM PROGRAM 'curl  "https://macrostrat.org/api/V2/defs/lithology_attributes?all&format=csv" | csvtool namedcol lith_att_id,name,type,t_units - ' WITH CSV HEADER;

COPY dicts.environments  FROM PROGRAM 'curl  "https://macrostrat.org/api/V2/defs/environments?all&format=csv" | csvtool namedcol environ_id,name,type,class,color,t_units - ' WITH CSV HEADER;

COPY dicts.grainsize  FROM PROGRAM 'curl  "https://macrostrat.org/api/V2/defs/grainsizes?all&format=csv" | csvtool namedcol grain_id,grain_symbol,grain_name,grain_group,soil_group,min_size,max_size,classification - ' WITH CSV HEADER;


