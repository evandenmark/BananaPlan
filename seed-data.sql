--
-- PostgreSQL database dump
--

\restrict zLMO9M9jFMKdKUt7W32XfDRihu4GhEZ2cXtPy4XasaCAVCCnHTusgABOG25czhJ

-- Dumped from database version 16.12 (Homebrew)
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: sites; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.sites (id, name, description, created_at) VALUES (1, 'Kemo''o', 'Upper valley site', '2026-03-07 21:25:56.915678');
INSERT INTO public.sites (id, name, description, created_at) VALUES (2, 'Big Tree', 'Lower valley site', '2026-03-07 21:25:56.915678');


--
-- Data for Name: fields; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.fields (id, site_id, name, size_acres, notes, is_active, created_at, updated_at) VALUES (1, 1, 'K1', 2.50, NULL, true, '2026-03-07 21:25:56.921358', '2026-03-07 21:25:56.921358');
INSERT INTO public.fields (id, site_id, name, size_acres, notes, is_active, created_at, updated_at) VALUES (2, 1, 'K2', 3.00, NULL, true, '2026-03-07 21:25:56.921358', '2026-03-07 21:25:56.921358');
INSERT INTO public.fields (id, site_id, name, size_acres, notes, is_active, created_at, updated_at) VALUES (3, 2, 'B1', 1.80, NULL, true, '2026-03-07 21:25:56.921358', '2026-03-07 21:25:56.921358');
INSERT INTO public.fields (id, site_id, name, size_acres, notes, is_active, created_at, updated_at) VALUES (4, 2, 'B2', 2.20, NULL, true, '2026-03-07 21:25:56.921358', '2026-03-07 21:25:56.921358');


--
-- Data for Name: varieties; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.varieties (id, name, description, months_to_first_bunch, months_to_subsequent_bunch, total_bunches_per_mat, bananas_per_bunch, pounds_per_bunch, success_rate, notes, created_at, updated_at) VALUES (1, 'Williams', 'Standard Cavendish, high yield', 14.00, 8.00, 4, NULL, 40.00, 0.850, NULL, '2026-03-07 21:25:56.919829', '2026-03-07 21:25:56.919829');
INSERT INTO public.varieties (id, name, description, months_to_first_bunch, months_to_subsequent_bunch, total_bunches_per_mat, bananas_per_bunch, pounds_per_bunch, success_rate, notes, created_at, updated_at) VALUES (2, 'Ice Cream', 'Blue Java, creamy texture', 18.00, 10.00, 3, NULL, 35.00, 0.800, NULL, '2026-03-07 21:25:56.919829', '2026-03-07 21:25:56.919829');
INSERT INTO public.varieties (id, name, description, months_to_first_bunch, months_to_subsequent_bunch, total_bunches_per_mat, bananas_per_bunch, pounds_per_bunch, success_rate, notes, created_at, updated_at) VALUES (3, 'Apple', 'Manzano, short and sweet', 15.00, 9.00, 3, NULL, 25.00, 0.750, NULL, '2026-03-07 21:25:56.919829', '2026-03-07 21:25:56.919829');


--
-- Data for Name: bunch_harvests; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.bunch_harvests (id, field_id, variety_id, bunches, harvest_date, notes, created_at) VALUES (1, 1, 1, 42, '2026-02-03', NULL, '2026-03-07 21:25:56.925005');
INSERT INTO public.bunch_harvests (id, field_id, variety_id, bunches, harvest_date, notes, created_at) VALUES (2, 4, 2, 10, '2026-02-12', NULL, '2026-03-07 21:25:56.925005');
INSERT INTO public.bunch_harvests (id, field_id, variety_id, bunches, harvest_date, notes, created_at) VALUES (4, 4, 1, 73, '2026-03-08', NULL, '2026-03-07 23:36:38.682386');


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: field_inventory; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.field_inventory (id, field_id, variety_id, number_of_mats, planting_date, notes, created_at, updated_at) VALUES (1, 1, 1, 50, '2024-12-01', NULL, '2026-03-07 21:25:56.923363', '2026-03-07 21:25:56.923363');
INSERT INTO public.field_inventory (id, field_id, variety_id, number_of_mats, planting_date, notes, created_at, updated_at) VALUES (2, 1, 2, 30, '2024-06-01', NULL, '2026-03-07 21:25:56.923363', '2026-03-07 21:25:56.923363');
INSERT INTO public.field_inventory (id, field_id, variety_id, number_of_mats, planting_date, notes, created_at, updated_at) VALUES (3, 2, 1, 80, '2025-06-01', NULL, '2026-03-07 21:25:56.923363', '2026-03-07 21:25:56.923363');
INSERT INTO public.field_inventory (id, field_id, variety_id, number_of_mats, planting_date, notes, created_at, updated_at) VALUES (4, 3, 3, 40, '2024-09-01', NULL, '2026-03-07 21:25:56.923363', '2026-03-07 21:25:56.923363');
INSERT INTO public.field_inventory (id, field_id, variety_id, number_of_mats, planting_date, notes, created_at, updated_at) VALUES (6, 4, 2, 25, '2024-08-01', NULL, '2026-03-07 21:25:56.923363', '2026-03-07 21:25:56.923363');
INSERT INTO public.field_inventory (id, field_id, variety_id, number_of_mats, planting_date, notes, created_at, updated_at) VALUES (5, 4, 1, 60, '2025-01-15', NULL, '2026-03-07 21:25:56.923363', '2026-03-07 21:25:56.923363');
INSERT INTO public.field_inventory (id, field_id, variety_id, number_of_mats, planting_date, notes, created_at, updated_at) VALUES (7, 1, 1, 50, '2025-01-01', NULL, '2026-03-07 23:31:56.917148', '2026-03-07 23:31:56.917148');
INSERT INTO public.field_inventory (id, field_id, variety_id, number_of_mats, planting_date, notes, created_at, updated_at) VALUES (8, 4, 1, 50, '2025-02-15', NULL, '2026-03-07 23:32:54.326992', '2026-03-07 23:32:54.326992');


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: weight_harvests; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.weight_harvests (id, variety_id, pounds, harvest_date, notes, created_at) VALUES (1, 1, 4000.00, '2026-03-08', NULL, '2026-03-07 21:29:39.805057');


--
-- Name: bunch_harvests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.bunch_harvests_id_seq', 4, true);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clients_id_seq', 1, false);


--
-- Name: field_inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.field_inventory_id_seq', 8, true);


--
-- Name: fields_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.fields_id_seq', 4, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 1, false);


--
-- Name: sites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.sites_id_seq', 2, true);


--
-- Name: varieties_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.varieties_id_seq', 3, true);


--
-- Name: weight_harvests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.weight_harvests_id_seq', 1, true);


--
-- PostgreSQL database dump complete
--

\unrestrict zLMO9M9jFMKdKUt7W32XfDRihu4GhEZ2cXtPy4XasaCAVCCnHTusgABOG25czhJ

