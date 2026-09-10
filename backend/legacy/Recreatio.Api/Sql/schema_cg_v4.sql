-- CG schema v4: file field type support
-- Run after schema_cg_v3.sql

ALTER TABLE dbo.CgFieldDefs ADD FileTypes NVARCHAR(100) NULL;
-- NULL = any file type; otherwise comma-separated categories: image,audio,video,document
