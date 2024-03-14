# Draft Technical Specification for Version 1.1 of AZLib Database

## Table of Contents
  - [Mandatory Changes](#mandatory-changes)
    - [Multi-branch Versioning](#multi-branch-versioning)
    - [Automate Upload to ScienceBase](#automate-upload-to-sciencebase)
  - [Requested Changes](#requested-changes)
    - [Ability To Preview Files](#ability-to-preview-files)
    - [Retain Form on Back](#retain-form-on-back)
    - [Bulk Download Options](#bulk-download-options)
    - [Search Optimization](#search-optimization)
  - [Unfinished Changes](#unfinished-changes)
    - [Removve Rasters Route](#removve-rasters-route)
    - [NCGMP and GeMS Routes](#ncgmp-and-gems-routes)
    - [Revised Upload Form](#revised-upload-form)
  - [Team Changes](#team-changes)
    - [Refactor MineData Documents](#refactor-minedata-documents)
    - [Redeploy Servers](#redeploy-servers)
    - [Metadata Validation Scripts](#metadata-validation-scripts)

## Mandatory Changes
Mandatory changes are feature upgrades that were proposed in a National Geophysical and Geological Data Preservation Program Grant and agreed upon in the final scope of work. These must be completed by project end -- currently slated for end of May 2024.

- [ ] [Multi-branch versioning](#multi-branch-versioning)
- [ ] [Automate Upload to ScienceBase](#automate-upload-to-sciencebase)

### Multi-branch Versioning
AZLIB has built-in functionality to track when new publications supersede older publications. The system currently has a very robust versioning system that explicitly allows new records to be classified as an edit of an existing record or the creation of a new record that supersedes a previous record. In other words, AZLIB is strong at tracking strictly linear progressions from a single predecessor publication to a single successor publication. However, AZGS has begun encountering situations where a predecessor article may be split into multiple successor articles (splitting) or where multiple preceding items may be compiled into a single superseding item (lumping). The most salient example of this is the split of a single map covering a large geographic area into multiple smaller maps, but this is not the only scenario where support for complex versioning is needed.

Five steps are necessary to add support for splitting and lumping data versions in AZLIB. First, a socalled ‘associative’ or ‘junction’ table will need to be added to the AZLIB relational database that will explicitly track the relationship of predecessors to their successors. This is the most common method in relational database management for supporting these types of ‘many-to-many’ relationships. Second, the current AZLIB API will need to be rewritten to support both querying and uploading data with complex version histories. This requires the refactoring of current AZLIB data validation and error-handling scripts to ensure data integrity is maintained. For example, there need to be rules that prohibit the accidental deletion of a predecessor version without deleting its current successor. Third, already versioned records within the AZLIB system will need to be retroactively converted over to use the new framework. Fourth, the data backup and restoration functionality of AZLIB (i.e., the ability to rollback a record to its previous version(s)) will need to be made compatible with the new versioning system. Last, the front-end website where end-users will upload or download data from AZLIB will need to be modified to reflect the new versioning options.

### Automate Upload to ScienceBase
Create a system for automated synchronization of metadata records between AZLIB and the USGS ReSciColl data system (formerly the National Digital Catalog). A middleware component will be added to AZLIB data system that performs four basic tasks to connect these two data services. First, the middleware will periodically check for any add, edit, or delete transactions made to the AZLIB database since its previous check. An API endpoint necessary to support such a query has already been implemented (https://data.azgs.arizona.edu/api/v1/changes). The principal work in implementing this step will therefore be to construct an algorithm that interprets the AZLIB change-log and determines whether an update to ReSciColl is appropriate. Second, the latest metadata information for these recently changed records will need to be ingested by the middleware. An API endpoint necessary to support such a query has also already been implemented (https://data.azgs.arizona.edu/api/v1/metadata). Third, the middleware component will need to convert the downloaded metadata records from the AZGS schema to the ScienceBase schema used by ReSciColl. The required fields and rules for the ScienceBase schema are already published in detail (https://my.usgs.gov/confluence/display/sciencebase/) and only a one-time mapping of fields will be necessary to establish translation protocols (e.g., what AZGS metadata refers to as the ‘abstract’ is referred to as the ‘body’ by ReSciColl). Last, the translated metadata will need to be uploaded to ReSciColl. A ReSciColl API endpoint already exists for item creation, deletion, and update (https://my.usgs.gov/confluence/display/sciencebase/). 

## Requested Changes
Requested changes are features that have been heavily requested by end-users. These changes are not mandatory and may be impossible to implement within a reasonable expenditure of resources, but must be reasonably investigated.

- [x] [Ability to Preview Files](#ability-to-preview-files)
- [x] [Retain Form on Back](#retain-form-on-back)
- [ ] [Bulk Download Options](#bulk-download-options)  
- [x] [Search Optimization](#inexct-text-search-and-optimize-search) 

### Ability To Preview Files
Users want the ability to download individual files listed in the `files` section of a collection instead of having to download the entire zip of the collection. This change would strike at the very heart of the data model and versioning system and would potentially requires significant redesign of the system, but is by far the most requested change by both internal AZGS staff and external end-users. A thorough investigation of options is needed.

### Retain Form on Back
Users want the search form to retain inputs after hitting back after viewing a collection.

### Bulk Download Options
Users have requested the ability to download all collections from a search return.

### Search Optimization
I've combined a variety of different search parameter upgrades here into one category.

1. Ability to order results by publication year
2. Ability to toggle exact vs. inexact text matching
3. Explore optimizations for full-text search algorithms
4. Support AND + OR syntax for keywords queries

## Unfinished Changes
Unfinished changes are features that were partially implemented during version 1.0 development, but were left unfinished -- often times with unsightly "placeholders" left.

- [ ] [Remove Rasters Route](#remove-rasters-route)
- [ ] [NCMGP and GeMS Routes](#ncgmp-and-gems-routes)
- [ ] [Revised Upload Form](#revised-upload-form)

### Remove Rasters Route
The original specification called for a route that could serve raster data directly. However, the AZGS has almost no data in this category. All traces of this route should simply be removed.

### NCGMP and GeMS Routes
A MAJOR goal of the AZLIB design was that GIS applications could stream in AZGS maps. We came close to being able to deploy this but things got really messy with the transition from NCGMP09 specification to GeMS specification.

First, we need to clean up the UPLOAD process to match the GIS team's current workflow. In particular, our data tables are slightly different from before and include different supplementary information. We also prefer to work with geopackages now instead of ESRI File GeoDatabases. Second, we need to finish and implement the DOWNLOAD option from the route so that data can be piped directly as geojson into leaflet or other web mapping tools as a REST request.

### Revised Upload Form
We currently have a temporary upload form that is functional, but operates completely separate from the main REACT webclient. The upload form needs to be brought into the same environment for consistenncy. In addition, user management tools (password reset, etc.) need to be integrated as well.

## Team Changes
Team changes are features that have been heavily requested internally by AZGS geoinformatics team members. These changes are not mandatory and may be impossible to implement within a reasonable expenditure of resources, but must be reasonably investigated.

- [ ] [Refactor MineData Documents](#refactor-minedata-documents)
- [x] [Redeploy Servers](#redeploy-servers)
- [ ] [Metadata Validation Scripts](#metadata-validation-scripts)

### Refactor MineData Documents
~~AZLIB currently serves data from two original sources: http://repository.azgs.az.gov (now decomissioned) and https://minedata.azgs.arizona.edu. Items from the latter source are currently placed in the `ADMMR` `collection_group` and can be identified by having a https://minedata.azgs.arizona.edu URL in the `AZGS_old` field of the `collections` table. Currently these are all marked as private so as not to overwhelm the search returns of the main AZLIB webpage (the ratio is 8:1).~~

~~An "excludes" parameter needs to be added to the API so that items from this collection_group can be excluded by default. Depending on how this is exactly implemented, there will need to be a variety of coprresponding front-end changes. These could be as complex as spinning up an entirely separate minedata subdomain of the current https://library.azgs.arizona.edu interface, but simpler solutions should be explored.~~

> This task has been moved to version 1.2 work spec (June 2025 due date).

### Redeploy Servers
At a minimum we need to blow away and then recreate the dev environment. Its database and pretty much everything else is *behind* rather than ahead of master. More ambitiously, we should consider moving both prod and dev into CCI early.

### Metadata Validation Scripts
We need scripts or triggers that make sure the information in collections table matches the information in metadata.azgs.
