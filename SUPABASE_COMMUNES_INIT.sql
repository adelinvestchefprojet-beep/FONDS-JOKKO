-- FONDS-JOKKO : initialisation des communes du Sénégal
-- À exécuter dans Supabase > SQL Editor.
-- La table communes doit déjà exister avec au minimum : id uuid, nom text, actif boolean.
-- Cette migration crée les communes à partir d'une liste maintenue dans le projet.
-- IMPORTANT : ne pas remplacer les UUID existants déjà utilisés par des profils/enquêtes.

insert into public.communes (nom, actif)
select v.nom, true
from (values
('Dakar'),('Guédiawaye'),('Pikine'),('Rufisque'),('Bargny'),('Diamniadio'),('Sébikhotane'),
('Thiès'),('Tivaouane'),('Mbour'),('Joal-Fadiouth'),('Mékhé'),('Pout'),
('Diourbel'),('Bambey'),('Touba'),('Mbacké'),('Khombole'),
('Fatick'),('Foundiougne'),('Gossas'),('Sokone'),('Passy'),('Fimela'),
('Kaolack'),('Nioro du Rip'),('Guinguinéo'),('Kaffrine'),('Koungheul'),('Birkelane'),
('Saint-Louis'),('Dagana'),('Podor'),('Richard-Toll'),('Ndioum'),('Rosso'),
('Louga'),('Kébémer'),('Linguère'),('Dahra'),('Coki'),('Ndiagne'),
('Matam'),('Kanel'),('Ranérou'),('Ourossogui'),('Thilogne'),
('Tambacounda'),('Bakel'),('Goudiry'),('Koumpentoum'),('Kidira'),
('Kédougou'),('Salémata'),('Saraya'),
('Ziguinchor'),('Bignona'),('Oussouye'),('Cap Skirring'),
('Kolda'),('Vélingara'),('Médina Yoro Foulah'),
('Sédhiou'),('Bounkiling'),('Goudomp')
) as v(nom)
where not exists (select 1 from public.communes c where lower(trim(c.nom))=lower(trim(v.nom)));

-- Vérification :
select id, nom, actif from public.communes order by nom;