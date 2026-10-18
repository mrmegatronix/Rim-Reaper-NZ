/**
 * Rim-Reaper-NZ — Embedded New Zealand Dataset (100% Offline Capable)
 * Includes:
 *  - Waka Kotahi NZTA State Highway Corridors (SH1–SH99) + Divided Road Metadata + RAMM RS/RP Stations
 *  - All 67 New Zealand Territorial Authorities (TAs) + Auckland Transport + Ward/Councillor Directory
 *  - Pre-loaded NZ Towns & Cities Gazetteer for Offline Trip Corridor Planning
 *  - Realistic Initial Seed Hazards for Immediate Out-of-the-Box Testing
 */

window.NZ_DATA = (function () {
  const NZTA_AGENCY = {
    id: 'NZTA-WAKA-KOTAHI',
    name: 'Waka Kotahi NZ Transport Agency',
    maoriName: 'Waka Kotahi',
    type: 'State Highway Authority',
    email: 'info@nzta.govt.nz',
    claimsEmail: 'customer.care@nzta.govt.nz',
    oiaEmail: 'official.correspondence@nzta.govt.nz',
    phone: '0800 4 HIGHWAYS (0800 44 44 49)',
    portal: 'https://www.journeys.nzta.govt.nz/',
    slaHours: 48,
    contractor: 'Fulton Hogan / Downer / Higgins / HEB'
  };

  // All 67 NZ Territorial Authorities + Auckland Transport with bounding boxes/centroids, wards, emails, SLAs
  const COUNCILS = [
    { id: 'FNDC', name: 'Far North District Council', island: 'North', lat: -35.21, lon: 173.55, r: 0.75, email: 'ask.us@fndc.govt.nz', ward: 'Te Hiku / Bay of Islands-Whangaroa / Kaikohe-Hokianga', councillor: 'councillors@fndc.govt.nz', phone: '0800 920 029', slaHours: 96, contractor: 'Fulton Hogan Northland' },
    { id: 'WDC-N', name: 'Whangarei District Council', island: 'North', lat: -35.72, lon: 174.32, r: 0.45, email: 'mailroom@wdc.govt.nz', ward: 'Whangarei Urban / Hikurangi-Coastal / Bream Bay', councillor: 'councillors@wdc.govt.nz', phone: '0800 932 463', slaHours: 72, contractor: 'Downer NZ' },
    { id: 'KDC', name: 'Kaipara District Council', island: 'North', lat: -35.99, lon: 174.05, r: 0.45, email: 'council@kaipara.govt.nz', ward: 'Kaiwaka-Mangawhai / Otamatea / Wairoa', councillor: 'electedmembers@kaipara.govt.nz', phone: '0800 727 059', slaHours: 96, contractor: 'Ventia / Downer' },
    { id: 'AT-AKL', name: 'Auckland Council / Auckland Transport (AT)', island: 'North', lat: -36.85, lon: 174.76, r: 0.65, email: 'at.govt.nz.reports@at.govt.nz', ward: 'Waitematā / North Shore / Manukau / Albany / Franklin / Rodney', councillor: 'councillors@aucklandcouncil.govt.nz', phone: '09 355 3553', slaHours: 48, contractor: 'Fulton Hogan / Ventia / Downer AT' },
    { id: 'TCDC', name: 'Thames-Coromandel District Council', island: 'North', lat: -36.93, lon: 175.65, r: 0.45, email: 'customer.services@tcdc.govt.nz', ward: 'Coromandel-Colville / Mercury Bay / Thames', councillor: 'councillors@tcdc.govt.nz', phone: '07 868 0200', slaHours: 72, contractor: 'Higgins Contractors' },
    { id: 'HDC-H', name: 'Hauraki District Council', island: 'North', lat: -37.38, lon: 175.56, r: 0.30, email: 'info@hauraki-dc.govt.nz', ward: 'Paeroa / Plains / Waihi', councillor: 'councillors@hauraki-dc.govt.nz', phone: '0800 734 834', slaHours: 72, contractor: 'Downer Hauraki' },
    { id: 'WDC-W', name: 'Waikato District Council', island: 'North', lat: -37.55, lon: 175.15, r: 0.45, email: 'consult@waidc.govt.nz', ward: 'Awaroa-Maramarua / Huntly / Ngaruawahia / Raglan', councillor: 'councillors@waidc.govt.nz', phone: '0800 492 452', slaHours: 72, contractor: 'Waikato District Alliance (Downer)' },
    { id: 'MPDC', name: 'Matamata-Piako District Council', island: 'North', lat: -37.67, lon: 175.68, r: 0.30, email: 'info@mpdc.govt.nz', ward: 'Matamata / Morrinsville / Te Aroha', councillor: 'councillors@mpdc.govt.nz', phone: '0800 746 467', slaHours: 72, contractor: 'Higgins Waikato' },
    { id: 'HCC-H', name: 'Hamilton City Council', island: 'North', lat: -37.78, lon: 175.28, r: 0.18, email: 'info@hcc.govt.nz', ward: 'East Ward / West Ward / Kirikiriroa', councillor: 'electedmembers@hcc.govt.nz', phone: '07 838 6699', slaHours: 48, contractor: 'Infrastructure Alliance Hamilton' },
    { id: 'WPDC', name: 'Waipa District Council', island: 'North', lat: -37.98, lon: 175.38, r: 0.30, email: 'info@waipadc.govt.nz', ward: 'Cambridge / Te Awamutu-Kihikihi / Pirongia', councillor: 'councillors@waipadc.govt.nz', phone: '0800 924 723', slaHours: 72, contractor: 'Downer Waipa' },
    { id: 'ODC', name: 'Ōtorohanga District Council', island: 'North', lat: -38.18, lon: 175.20, r: 0.35, email: 'info@otodc.govt.nz', ward: 'Kāwhia-Tihiroa / Ōtorohanga / Waipa', councillor: 'councillors@otodc.govt.nz', phone: '0800 734 000', slaHours: 96, contractor: 'Inframax Construction' },
    { id: 'SWDC-W', name: 'South Waikato District Council', island: 'North', lat: -38.22, lon: 175.86, r: 0.32, email: 'info@southwaikato.govt.nz', ward: 'Tokoroa / Putāruru / Tīrau', councillor: 'councillors@southwaikato.govt.nz', phone: '07 885 0340', slaHours: 72, contractor: 'Downer South Waikato' },
    { id: 'WDC-K', name: 'Waitomo District Council', island: 'North', lat: -38.45, lon: 175.10, r: 0.40, email: 'info@waitomo.govt.nz', ward: 'Te Kuiti Urban / Waitomo Rural', councillor: 'councillors@waitomo.govt.nz', phone: '0800 932 435', slaHours: 96, contractor: 'Inframax Construction' },
    { id: 'TDC-T', name: 'Taupō District Council', island: 'North', lat: -38.68, lon: 176.07, r: 0.55, email: 'info@taupo.govt.nz', ward: 'Taupō-Kaingaroa / Turangi-Tongariro / Mangakino', councillor: 'councillors@taupo.govt.nz', phone: '0800 275 832', slaHours: 72, contractor: 'Downer Taupō' },
    { id: 'WBOP', name: 'Western Bay of Plenty District Council', island: 'North', lat: -37.65, lon: 176.02, r: 0.35, email: 'customerservice@westernbay.govt.nz', ward: 'Katikati-Waihi Beach / Kaimai / Maketu-Te Puke', councillor: 'councillors@westernbay.govt.nz', phone: '0800 926 732', slaHours: 72, contractor: 'WestLink BOP' },
    { id: 'TCC', name: 'Tauranga City Council', island: 'North', lat: -37.68, lon: 176.16, r: 0.18, email: 'info@tauranga.govt.nz', ward: 'Mauao / Pāpāmoa / Welcome Bay / Otūmoetai', councillor: 'councillors@tauranga.govt.nz', phone: '07 577 7000', slaHours: 48, contractor: 'Fulton Hogan Tauranga' },
    { id: 'RLC', name: 'Rotorua Lakes Council', island: 'North', lat: -38.13, lon: 176.25, r: 0.38, email: 'info@rotorualc.nz', ward: 'Rotorua General / Rural Ward / Te Ipu Wai', councillor: 'councillors@rotorualc.nz', phone: '07 348 4199', slaHours: 72, contractor: 'Fulton Hogan / Higgins Rotorua' },
    { id: 'WHK', name: 'Whakatāne District Council', island: 'North', lat: -37.95, lon: 176.98, r: 0.45, email: 'info@whakatane.govt.nz', ward: 'Whakatāne-Ōhope / Rangitāiki / Galatea-Murupara', councillor: 'councillors@whakatane.govt.nz', phone: '07 306 0500', slaHours: 72, contractor: 'Higgins Eastern BOP' },
    { id: 'KAW', name: 'Kawerau District Council', island: 'North', lat: -38.08, lon: 176.70, r: 0.12, email: 'kaweraudc@kaweraudc.govt.nz', ward: 'Kawerau At-Large Ward', councillor: 'electedmembers@kaweraudc.govt.nz', phone: '07 306 9009', slaHours: 72, contractor: 'Kawerau Council Ops' },
    { id: 'OPO', name: 'Ōpōtiki District Council', island: 'North', lat: -38.00, lon: 177.28, r: 0.45, email: 'info@odc.govt.nz', ward: 'Ōpōtiki / Coast / Waioeka-Waiōtahe', councillor: 'councillors@odc.govt.nz', phone: '07 315 3030', slaHours: 96, contractor: 'Horizon Services / Fulton Hogan' },
    { id: 'GDC', name: 'Gisborne District Council (Tairāwhiti)', island: 'North', lat: -38.66, lon: 178.01, r: 0.65, email: 'service@gdc.govt.nz', ward: 'Tairāwhiti General / Tawhiti-a-Pawa', councillor: 'councillors@gdc.govt.nz', phone: '0800 653 800', slaHours: 72, contractor: 'Fulton Hogan Tairāwhiti' },
    { id: 'WRO', name: 'Wairoa District Council', island: 'North', lat: -39.03, lon: 177.41, r: 0.45, email: 'info@wairoadc.govt.nz', ward: 'Wairoa General / Māori Ward', councillor: 'councillors@wairoadc.govt.nz', phone: '06 838 7309', slaHours: 96, contractor: 'QRS Wairoa' },
    { id: 'HDC-HB', name: 'Hastings District Council', island: 'North', lat: -39.63, lon: 176.84, r: 0.45, email: 'customerservice@hdc.govt.nz', ward: 'Hastings-Havelock North / Flaxmere / Mohaka / Kahurānaki', councillor: 'councillors@hdc.govt.nz', phone: '06 871 5000', slaHours: 72, contractor: 'Fulton Hogan Hawke’s Bay' },
    { id: 'NCC-HB', name: 'Napier City Council', island: 'North', lat: -39.49, lon: 176.91, r: 0.16, email: 'info@napier.govt.nz', ward: 'Ahuriri / Napier Central / Nelson Park / Taradale', councillor: 'councillors@napier.govt.nz', phone: '06 835 7579', slaHours: 48, contractor: 'Downer Napier' },
    { id: 'CHB', name: 'Central Hawke’s Bay District Council', island: 'North', lat: -39.99, lon: 176.55, r: 0.40, email: 'customerservice@chbdc.govt.nz', ward: 'Ruataniwha / Aramoana', councillor: 'councillors@chbdc.govt.nz', phone: '06 857 8060', slaHours: 96, contractor: 'Higgins CHB' },
    { id: 'NPDC', name: 'New Plymouth District Council', island: 'North', lat: -39.05, lon: 174.07, r: 0.35, email: 'enquiries@npdc.govt.nz', ward: 'Ngāmotu-New Plymouth / Kaitake-Ngāmotu / North /Waitara', councillor: 'councillors@npdc.govt.nz', phone: '06 759 6060', slaHours: 72, contractor: 'Downer Taranaki' },
    { id: 'SDC-T', name: 'Stratford District Council', island: 'North', lat: -39.34, lon: 174.28, r: 0.28, email: 'stratforddc@stratford.govt.nz', ward: 'Stratford Urban / Rural', councillor: 'councillors@stratford.govt.nz', phone: '06 765 6099', slaHours: 72, contractor: 'Fulton Hogan Taranaki' },
    { id: 'STDC', name: 'South Taranaki District Council', island: 'North', lat: -39.58, lon: 174.28, r: 0.38, email: 'contact@STDC.govt.nz', ward: 'Te Hāwera / Eltham-Kaponga / Pātea / Taranaki Coastal', councillor: 'councillors@stdc.govt.nz', phone: '0800 111 323', slaHours: 72, contractor: 'Downer South Taranaki' },
    { id: 'RDC', name: 'Ruapehu District Council', island: 'North', lat: -39.15, lon: 175.40, r: 0.50, email: 'info@ruapehudc.govt.nz', ward: 'Taumarunui / Ohakune-Waimarino / Waiouru', councillor: 'councillors@ruapehudc.govt.nz', phone: '07 895 8188', slaHours: 96, contractor: 'Downer Ruapehu' },
    { id: 'WDC-WG', name: 'Whanganui District Council', island: 'North', lat: -39.93, lon: 175.05, r: 0.35, email: 'yourcouncil@whanganui.govt.nz', ward: 'Whanganui General / Rural Community', councillor: 'councillors@whanganui.govt.nz', phone: '06 349 0001', slaHours: 72, contractor: 'Whanganui Alliance (Downer)' },
    { id: 'RNG', name: 'Rangitīkei District Council', island: 'North', lat: -39.90, lon: 175.55, r: 0.45, email: 'info@rangitikei.govt.nz', ward: 'Northern / Central (Marton) / Southern (Bulls)', councillor: 'councillors@rangitikei.govt.nz', phone: '0800 422 522', slaHours: 96, contractor: 'Higgins Rangitīkei' },
    { id: 'MDC-M', name: 'Manawatū District Council', island: 'North', lat: -40.22, lon: 175.56, r: 0.32, email: 'public@mdc.govt.nz', ward: 'Feilding Urban / Manawatū Rural', councillor: 'councillors@mdc.govt.nz', phone: '06 323 0000', slaHours: 72, contractor: 'Higgins Manawatū' },
    { id: 'PNCC', name: 'Palmerston North City Council', island: 'North', lat: -40.35, lon: 175.61, r: 0.18, email: 'info@pncc.govt.nz', ward: 'Te Hirawanui / Papaioea / Ashhurst-Fitzherbert', councillor: 'councillors@pncc.govt.nz', phone: '06 356 8199', slaHours: 48, contractor: 'Higgins / PNCC Roading' },
    { id: 'TDC-D', name: 'Tararua District Council', island: 'North', lat: -40.35, lon: 176.10, r: 0.45, email: 'info@tararuadc.govt.nz', ward: 'North Tararua (Dannevirke) / South Tararua (Pahiatua)', councillor: 'councillors@tararuadc.govt.nz', phone: '06 374 4080', slaHours: 72, contractor: 'Tararua Alliance (Downer)' },
    { id: 'HDC-L', name: 'Horowhenua District Council', island: 'North', lat: -40.62, lon: 175.28, r: 0.28, email: 'enquiries@horowhenua.govt.nz', ward: 'Levin / KereKere / Miranui / Waiopehu', councillor: 'councillors@horowhenua.govt.nz', phone: '06 366 0999', slaHours: 72, contractor: 'Fulton Hogan Horowhenua' },
    { id: 'KCDC', name: 'Kāpiti Coast District Council', island: 'North', lat: -40.91, lon: 175.01, r: 0.25, email: 'kapiti.council@kapiticoast.govt.nz', ward: 'Paraparaumu / Waikanae / Ōtaki / Paekākāriki-Raumati', councillor: 'councillors@kapiticoast.govt.nz', phone: '0800 486 486', slaHours: 72, contractor: 'Downer Kāpiti' },
    { id: 'PCC', name: 'Porirua City Council', island: 'North', lat: -41.13, lon: 174.84, r: 0.15, email: 'enquiries@poriruacity.govt.nz', ward: 'Onepoto / Pāuatahanui / Parirua', councillor: 'councillors@poriruacity.govt.nz', phone: '04 237 5089', slaHours: 48, contractor: 'Downer Porirua' },
    { id: 'UHCC', name: 'Upper Hutt City Council', island: 'North', lat: -41.12, lon: 175.07, r: 0.18, email: 'askus@uhcc.govt.nz', ward: 'Upper Hutt At-Large Ward', councillor: 'councillors@uhcc.govt.nz', phone: '04 527 2169', slaHours: 48, contractor: 'Fulton Hogan Wellington' },
    { id: 'HCC-LH', name: 'Hutt City Council (Lower Hutt)', island: 'North', lat: -41.21, lon: 174.91, r: 0.16, email: 'contact@huttcity.govt.nz', ward: 'Central / Eastern / Harbour / Northern / Wainuiomata / Western', councillor: 'councillors@huttcity.govt.nz', phone: '04 570 6666', slaHours: 48, contractor: 'Downer Lower Hutt' },
    { id: 'WCC', name: 'Wellington City Council', island: 'North', lat: -41.29, lon: 174.77, r: 0.16, email: 'info@wcc.govt.nz', ward: 'Pukehīnau-Lambton / Motukairangi-Eastern / Paekawakawa-Southern / Wharangi-Onslow-Western', councillor: 'councillors@wcc.govt.nz', phone: '04 499 4444', slaHours: 48, contractor: 'Fulton Hogan / Downer Wellington' },
    { id: 'MDC-W', name: 'Masterton District Council', island: 'North', lat: -40.95, lon: 175.65, r: 0.35, email: 'mdc@mstn.govt.nz', ward: 'Masterton Urban / Rural', councillor: 'councillors@mstn.govt.nz', phone: '06 370 6300', slaHours: 72, contractor: 'Higgins Wairarapa' },
    { id: 'CDC', name: 'Carterton District Council', island: 'North', lat: -41.02, lon: 175.52, r: 0.22, email: 'info@cdc.govt.nz', ward: 'Carterton At-Large Ward', councillor: 'councillors@cdc.govt.nz', phone: '06 379 4030', slaHours: 72, contractor: 'Fulton Hogan Wairarapa' },
    { id: 'SWDC-S', name: 'South Wairarapa District Council', island: 'North', lat: -41.22, lon: 175.42, r: 0.32, email: 'enquiries@swdc.govt.nz', ward: 'Featherston / Greytown / Martinborough', councillor: 'councillors@swdc.govt.nz', phone: '06 306 9611', slaHours: 72, contractor: 'Fulton Hogan Wairarapa' },
    { id: 'TDC-N', name: 'Tasman District Council', island: 'South', lat: -41.27, lon: 172.90, r: 0.55, email: 'info@tasman.govt.nz', ward: 'Golden Bay / Lakes-Murchison / Moutere-Waimea / Motueka / Richmond', councillor: 'councillors@tasman.govt.nz', phone: '03 543 8400', slaHours: 72, contractor: 'Downer Tasman' },
    { id: 'NCC-N', name: 'Nelson City Council', island: 'South', lat: -41.27, lon: 173.28, r: 0.16, email: 'enquiry@ncc.govt.nz', ward: 'Central / Stoke-Tāhunanui', councillor: 'councillors@ncc.govt.nz', phone: '03 546 0200', slaHours: 48, contractor: 'Nelmac / Fulton Hogan Nelson' },
    { id: 'MDC-B', name: 'Marlborough District Council', island: 'South', lat: -41.51, lon: 173.95, r: 0.55, email: 'mdc@marlborough.govt.nz', ward: 'Blenheim / Marlborough Sounds / Wairau-Awatere', councillor: 'councillors@marlborough.govt.nz', phone: '03 520 7400', slaHours: 72, contractor: 'Marlborough Roads (HEB / Fulton Hogan)' },
    { id: 'KDC-S', name: 'Kaikōura District Council', island: 'South', lat: -42.40, lon: 173.68, r: 0.35, email: 'kdc@kaikoura.govt.nz', ward: 'Kaikōura At-Large Ward', councillor: 'councillors@kaikoura.govt.nz', phone: '03 319 5026', slaHours: 72, contractor: 'Downer Kaikōura' },
    { id: 'BDC', name: 'Buller District Council', island: 'South', lat: -41.75, lon: 171.60, r: 0.55, email: 'info@bdc.govt.nz', ward: 'Westport / Inangahua / Seddon', councillor: 'councillors@bdc.govt.nz', phone: '0800 807 239', slaHours: 96, contractor: 'WestReef Services' },
    { id: 'GDC-S', name: 'Grey District Council', island: 'South', lat: -42.45, lon: 171.21, r: 0.45, email: 'info@greydc.govt.nz', ward: 'Central (Greymouth) / Northern / Southern / Eastern', councillor: 'councillors@greydc.govt.nz', phone: '03 769 8600', slaHours: 72, contractor: 'Fulton Hogan West Coast' },
    { id: 'WDC-WC', name: 'Westland District Council', island: 'South', lat: -43.25, lon: 170.50, r: 0.85, email: 'council@westlanddc.govt.nz', ward: 'Hokitika / Northern / Southern (Franz Josef / Haast)', councillor: 'councillors@westlanddc.govt.nz', phone: '0800 474 834', slaHours: 96, contractor: 'Fulton Hogan West Coast' },
    { id: 'HDC-C', name: 'Hurunui District Council', island: 'South', lat: -42.85, lon: 172.75, r: 0.48, email: 'info@hurunui.govt.nz', ward: 'Amberley / Amuri-Hurunui / Cheviot / Hanmer Springs', councillor: 'councillors@hurunui.govt.nz', phone: '03 314 8816', slaHours: 72, contractor: 'Fulton Hogan Canterbury' },
    { id: 'WMK', name: 'Waimakariri District Council', island: 'South', lat: -43.30, lon: 172.50, r: 0.32, email: 'office@wmk.govt.nz', ward: 'Kaiapoi-Woodend / Oxford-Ohoka / Rangiora-Ashley', councillor: 'councillors@wmk.govt.nz', phone: '0800 965 468', slaHours: 72, contractor: 'Corvanta / Fulton Hogan' },
    { id: 'CCC', name: 'Christchurch City Council', island: 'South', lat: -43.53, lon: 172.63, r: 0.30, email: 'info@ccc.govt.nz', ward: 'Central / Riccarton / Fendalton / Papanui / Halswell / Banks Peninsula', councillor: 'councillors@ccc.govt.nz', phone: '03 941 8999', slaHours: 48, contractor: 'Fulton Hogan / Citycare / Downer Chch' },
    { id: 'SDC-C', name: 'Selwyn District Council', island: 'South', lat: -43.58, lon: 172.05, r: 0.45, email: 'contactus@selwyn.govt.nz', ward: 'Rolleston / Lincoln / Malvern (Darfield / Arthur’s Pass) / Ellesmere', councillor: 'councillors@selwyn.govt.nz', phone: '0800 735 996', slaHours: 72, contractor: 'HEB Construction Selwyn' },
    { id: 'ADC', name: 'Ashburton District Council', island: 'South', lat: -43.90, lon: 171.75, r: 0.42, email: 'info@adc.govt.nz', ward: 'Ashburton / Eastern / Western (Methven)', councillor: 'councillors@adc.govt.nz', phone: '03 307 7700', slaHours: 72, contractor: 'ACL / Fulton Hogan Mid-Canterbury' },
    { id: 'TDC-C', name: 'Timaru District Council', island: 'South', lat: -44.39, lon: 171.25, r: 0.35, email: 'enquiry@timdc.govt.nz', ward: 'Timaru / Geraldine / Pleasant Point-Temuka', councillor: 'councillors@timdc.govt.nz', phone: '03 687 7200', slaHours: 72, contractor: 'Fulton Hogan South Canterbury' },
    { id: 'MKDC', name: 'Mackenzie District Council', island: 'South', lat: -44.00, lon: 170.48, r: 0.55, email: 'info@mackenzie.govt.nz', ward: 'Opuha (Fairlie) / Pukaki (Twizel / Tekapo)', councillor: 'councillors@mackenzie.govt.nz', phone: '0800 685 8514', slaHours: 96, contractor: 'Whitestone Contracting' },
    { id: 'WDC-C', name: 'Waimate District Council', island: 'South', lat: -44.73, lon: 171.05, r: 0.35, email: 'council@waimatedc.govt.nz', ward: 'Waimate / Hakataramea-Waihao / Pareora-Otaio-Makikihi', councillor: 'councillors@waimatedc.govt.nz', phone: '03 689 0000', slaHours: 72, contractor: 'Road Metals / Fulton Hogan' },
    { id: 'CODC', name: 'Central Otago District Council', island: 'South', lat: -45.25, lon: 169.38, r: 0.55, email: 'info@codc.govt.nz', ward: 'Vincent (Alexandra / Clyde) / Cromwell / Maniototo / Teviot Valley', councillor: 'councillors@codc.govt.nz', phone: '03 440 0056', slaHours: 72, contractor: 'Fulton Hogan Central Otago' },
    { id: 'QLDC', name: 'Queenstown-Lakes District Council', island: 'South', lat: -45.03, lon: 168.66, r: 0.55, email: 'services@qldc.govt.nz', ward: 'Queenstown-Whakatipu / Arrowtown-Kawarau / Wānaka-Upper Clutha', councillor: 'councillors@qldc.govt.nz', phone: '03 441 0499', slaHours: 48, contractor: 'Downer QLDC Alliance' },
    { id: 'WDC-O', name: 'Waitaki District Council', island: 'South', lat: -45.10, lon: 170.97, r: 0.45, email: 'service@waitaki.govt.nz', ward: 'Oamaru / Ahuriri / Corriedale / Waihemo', councillor: 'councillors@waitaki.govt.nz', phone: '03 433 0300', slaHours: 72, contractor: 'Whitestone Contracting' },
    { id: 'DCC', name: 'Dunedin City Council', island: 'South', lat: -45.87, lon: 170.50, r: 0.35, email: 'dcc@dcc.govt.nz', ward: 'Dunedin Central / Mosgiel-Taieri / Otago Peninsula / Waikouaiti Coast', councillor: 'councillors@dcc.govt.nz', phone: '03 477 4000', slaHours: 48, contractor: 'Fulton Hogan Dunedin' },
    { id: 'CDC-O', name: 'Clutha District Council', island: 'South', lat: -46.23, lon: 169.75, r: 0.45, email: 'help.desk@cluthadc.govt.nz', ward: 'Balclutha / Milton / Catlins / West Otago / Lawrence-Tuapeka', councillor: 'councillors@cluthadc.govt.nz', phone: '0800 801 350', slaHours: 96, contractor: 'SouthRoads Clutha' },
    { id: 'SDC-S', name: 'Southland District Council', island: 'South', lat: -45.90, lon: 168.10, r: 0.75, email: 'emailsdc@southlanddc.govt.nz', ward: 'Fiordland (Te Anau) / Northern / Oreti / Wallace-Takitimu / Stewart Island-Rakiura', councillor: 'councillors@southlanddc.govt.nz', phone: '0800 732 732', slaHours: 96, contractor: 'Downer / SouthRoads Southland' },
    { id: 'GDC-G', name: 'Gore District Council', island: 'South', lat: -46.10, lon: 168.94, r: 0.25, email: 'info@goredc.govt.nz', ward: 'Gore / Mataura / Kaiwera-Waimumu', councillor: 'councillors@goredc.govt.nz', phone: '03 209 0330', slaHours: 72, contractor: 'SouthRoads Gore' },
    { id: 'ICC', name: 'Invercargill City Council', island: 'South', lat: -46.41, lon: 168.35, r: 0.18, email: 'service@icc.govt.nz', ward: 'Invercargill / Bluff Community', councillor: 'councillors@icc.govt.nz', phone: '03 211 1777', slaHours: 48, contractor: 'SouthRoads / Fulton Hogan Invercargill' },
    { id: 'CIC', name: 'Chatham Islands Council', island: 'Chatham', lat: -43.95, lon: 176.54, r: 0.50, email: 'info@cic.govt.nz', ward: 'Wharekauri / Rekohu Ward', councillor: 'councillors@cic.govt.nz', phone: '03 305 0033', slaHours: 120, contractor: 'Fulton Hogan Chathams' }
  ];

  // State Highway Corridors (SH1 - SH94) with RAMM Route Stations (RS) and Divided Carriageway Metadata
  const STATE_HIGHWAYS = [
    {
      code: 'SH1',
      name: 'State Highway 1 (Te Hiku o Te Ika to Stirling Point Bluff)',
      dividedSegments: [
        { name: 'Auckland Northern & Southern Motorway', minLat: -37.22, maxLat: -36.55 },
        { name: 'Waikato Expressway (Mercer to Cambridge)', minLat: -37.92, maxLat: -37.22 },
        { name: 'Kapiti Expressway & Transmission Gully', minLat: -41.22, maxLat: -40.75 },
        { name: 'Christchurch Northern Corridor', minLat: -43.48, maxLat: -43.32 }
      ],
      speedLimit: 100,
      waypoints: [
        { name: 'Cape Reinga', lat: -34.4268, lon: 172.6775, rammRS: 1 },
        { name: 'Kaitaia', lat: -35.1130, lon: 173.2625, rammRS: 104 },
        { name: 'Whangārei', lat: -35.7251, lon: 174.3237, rammRS: 254 },
        { name: 'Dome Valley', lat: -36.3640, lon: 174.6210, rammRS: 342 },
        { name: 'Auckland CBD (CMJ)', lat: -36.8509, lon: 174.7645, rammRS: 416 },
        { name: 'Hamilton / Waikato Expy', lat: -37.7870, lon: 175.2793, rammRS: 540 },
        { name: 'Taupō', lat: -38.6857, lon: 176.0702, rammRS: 678 },
        { name: 'Desert Road Summit', lat: -39.2950, lon: 175.7380, rammRS: 760 },
        { name: 'Bulls', lat: -40.1740, lon: 175.3840, rammRS: 882 },
        { name: 'Transmission Gully / Wellington', lat: -41.2865, lon: 174.7762, rammRS: 1045 },
        { name: 'Picton', lat: -41.2930, lon: 174.0019, rammRS: 1060 },
        { name: 'Blenheim', lat: -41.5134, lon: 173.9612, rammRS: 1088 },
        { name: 'Kaikōura Coast', lat: -42.4008, lon: 173.6814, rammRS: 1218 },
        { name: 'Christchurch', lat: -43.5321, lon: 172.6362, rammRS: 1400 },
        { name: 'Timaru', lat: -44.3904, lon: 171.2373, rammRS: 1560 },
        { name: 'Dunedin', lat: -45.8788, lon: 170.5028, rammRS: 1758 },
        { name: 'Invercargill / Bluff', lat: -46.6000, lon: 168.3420, rammRS: 1965 }
      ]
    },
    {
      code: 'SH2',
      name: 'State Highway 2 (Pōkeno — Tauranga — Gisborne — Hawke’s Bay — Remutaka — Wellington)',
      dividedSegments: [
        { name: 'Tauranga Eastern Link', minLat: -37.82, maxLat: -37.65 },
        { name: 'SH2 Hutt Road / Petone to Upper Hutt', minLat: -41.25, maxLat: -41.12 }
      ],
      speedLimit: 100,
      waypoints: [
        { name: 'Pōkeno Junction', lat: -37.2430, lon: 175.0180, rammRS: 1 },
        { name: 'Karangahake Gorge', lat: -37.4190, lon: 175.7210, rammRS: 74 },
        { name: 'Tauranga', lat: -37.6878, lon: 176.1651, rammRS: 138 },
        { name: 'Ōpōtiki / Waioeka Gorge', lat: -38.1950, lon: 177.3810, rammRS: 270 },
        { name: 'Gisborne', lat: -38.6623, lon: 178.0176, rammRS: 365 },
        { name: 'Wairoa / Devil’s Elbow', lat: -39.2450, lon: 176.8900, rammRS: 495 },
        { name: 'Napier / Hastings', lat: -39.4928, lon: 176.9120, rammRS: 540 },
        { name: 'Masterton', lat: -40.9511, lon: 175.6573, rammRS: 750 },
        { name: 'Remutaka Hill Summit', lat: -41.1145, lon: 175.2285, rammRS: 805 },
        { name: 'Wellington / Ngauranga', lat: -41.2460, lon: 174.8140, rammRS: 855 }
      ]
    },
    {
      code: 'SH3',
      name: 'State Highway 3 (Hamilton — Awakino Gorge — New Plymouth — Whanganui — Palmerston North)',
      dividedSegments: [],
      speedLimit: 100,
      waypoints: [
        { name: 'Hamilton', lat: -37.7870, lon: 175.2793, rammRS: 1 },
        { name: 'Te Kūiti', lat: -38.3350, lon: 175.1640, rammRS: 76 },
        { name: 'Awakino Gorge', lat: -38.6590, lon: 174.6640, rammRS: 145 },
        { name: 'New Plymouth', lat: -39.0556, lon: 174.0752, rammRS: 238 },
        { name: 'Whanganui', lat: -39.9301, lon: 175.0479, rammRS: 398 },
        { name: 'Palmerston North', lat: -40.3523, lon: 175.6082, rammRS: 472 }
      ]
    },
    {
      code: 'SH5',
      name: 'State Highway 5 (Tirau — Rotorua — Taupō — Napier-Taupō Road)',
      dividedSegments: [],
      speedLimit: 100,
      waypoints: [
        { name: 'Tīrau', lat: -37.9770, lon: 175.7580, rammRS: 1 },
        { name: 'Rotorua', lat: -38.1368, lon: 176.2497, rammRS: 58 },
        { name: 'Taupō', lat: -38.6857, lon: 176.0702, rammRS: 135 },
        { name: 'Tītīokura Summit (Napier-Taupō)', lat: -39.2080, lon: 176.5920, rammRS: 210 },
        { name: 'Eskdale / Napier', lat: -39.4020, lon: 176.8420, rammRS: 262 }
      ]
    },
    {
      code: 'SH6',
      name: 'State Highway 6 (Blenheim — Nelson — Buller Gorge — West Coast — Haast — Queenstown — Invercargill)',
      dividedSegments: [],
      speedLimit: 100,
      waypoints: [
        { name: 'Blenheim', lat: -41.5134, lon: 173.9612, rammRS: 1 },
        { name: 'Nelson', lat: -41.2706, lon: 173.2840, rammRS: 116 },
        { name: 'Buller Gorge / Murchison', lat: -41.8010, lon: 172.3250, rammRS: 242 },
        { name: 'Greymouth', lat: -42.4504, lon: 171.2108, rammRS: 390 },
        { name: 'Franz Josef / Fox Glacier', lat: -43.3890, lon: 170.1820, rammRS: 565 },
        { name: 'Haast Pass', lat: -44.1065, lon: 169.3540, rammRS: 710 },
        { name: 'Wānaka / Cromwell', lat: -44.7032, lon: 169.1321, rammRS: 815 },
        { name: 'Kawarau Gorge / Queenstown', lat: -45.0312, lon: 168.6626, rammRS: 895 },
        { name: 'Invercargill', lat: -46.4132, lon: 168.3538, rammRS: 1082 }
      ]
    },
    {
      code: 'SH25',
      name: 'State Highway 25 (Coromandel Peninsula Loop — Kopu — Thames — Whitianga — Whangamatā — Waihi)',
      dividedSegments: [],
      speedLimit: 80,
      waypoints: [
        { name: 'Kopu Bridge / Thames', lat: -37.1430, lon: 175.5460, rammRS: 1 },
        { name: 'Coromandel Town', lat: -36.7610, lon: 175.4960, rammRS: 55 },
        { name: 'Whitianga / Kūaotunu', lat: -36.8330, lon: 175.6990, rammRS: 98 },
        { name: 'Tairua / Whangamatā', lat: -37.2060, lon: 175.8720, rammRS: 162 },
        { name: 'Waihi', lat: -37.3920, lon: 175.8400, rammRS: 196 }
      ]
    },
    {
      code: 'SH35',
      name: 'State Highway 35 (Pacific Coast Highway — Ōpōtiki — East Cape — Tolaga Bay — Gisborne)',
      dividedSegments: [],
      speedLimit: 80,
      waypoints: [
        { name: 'Ōpōtiki', lat: -38.0050, lon: 177.2850, rammRS: 1 },
        { name: 'Te Kaha', lat: -37.7380, lon: 177.6790, rammRS: 66 },
        { name: 'Hicks Bay / Te Araroa', lat: -37.6380, lon: 178.3610, rammRS: 145 },
        { name: 'Ruatoria / Tokomaru Bay', lat: -38.1280, lon: 178.3210, rammRS: 235 },
        { name: 'Tolaga Bay / Gisborne', lat: -38.6623, lon: 178.0176, rammRS: 325 }
      ]
    },
    {
      code: 'SH73',
      name: 'State Highway 73 (Great Alpine Highway — Christchurch — Arthur’s Pass — Otira Viaduct — Kumara)',
      dividedSegments: [],
      speedLimit: 100,
      waypoints: [
        { name: 'Christchurch', lat: -43.5321, lon: 172.6362, rammRS: 1 },
        { name: 'Springfield / Porters Pass', lat: -43.2980, lon: 171.7410, rammRS: 74 },
        { name: 'Arthur’s Pass / Otira Viaduct', lat: -42.9052, lon: 171.5594, rammRS: 152 },
        { name: 'Kumara Junction', lat: -42.6050, lon: 171.1960, rammRS: 224 }
      ]
    },
    {
      code: 'SH94',
      name: 'State Highway 94 (Gore — Lumsden — Te Anau — Homer Tunnel — Milford Sound / Piopiotahi)',
      dividedSegments: [],
      speedLimit: 80,
      waypoints: [
        { name: 'Gore', lat: -46.1028, lon: 168.9436, rammRS: 1 },
        { name: 'Te Anau', lat: -45.4145, lon: 167.7180, rammRS: 138 },
        { name: 'Hollyford / Homer Tunnel East Portal', lat: -44.7642, lon: 167.9891, rammRS: 236 },
        { name: 'Milford Sound / Piopiotahi', lat: -44.6716, lon: 167.9256, rammRS: 256 }
      ]
    }
  ];

  // Gazetteer of NZ Towns & Cities for Offline Trip Corridor Scanner
  const TOWNS = [
    { name: 'Cape Reinga (Te Rerenga Wairua)', lat: -34.4268, lon: 172.6775, region: 'Northland' },
    { name: 'Kaitaia', lat: -35.1130, lon: 173.2625, region: 'Northland' },
    { name: 'Kerikeri / Bay of Islands', lat: -35.2280, lon: 173.9480, region: 'Northland' },
    { name: 'Whangārei', lat: -35.7251, lon: 174.3237, region: 'Northland' },
    { name: 'Warkworth / Dome Valley', lat: -36.3980, lon: 174.6650, region: 'Auckland' },
    { name: 'Auckland CBD (Waitematā)', lat: -36.8509, lon: 174.7645, region: 'Auckland' },
    { name: 'Manukau / South Auckland', lat: -36.9928, lon: 174.8798, region: 'Auckland' },
    { name: 'Thames / Coromandel', lat: -37.1383, lon: 175.5401, region: 'Waikato' },
    { name: 'Whitianga', lat: -36.8330, lon: 175.6990, region: 'Waikato' },
    { name: 'Hamilton (Kirikiriroa)', lat: -37.7870, lon: 175.2793, region: 'Waikato' },
    { name: 'Tauranga', lat: -37.6878, lon: 176.1651, region: 'Bay of Plenty' },
    { name: 'Rotorua', lat: -38.1368, lon: 176.2497, region: 'Bay of Plenty' },
    { name: 'Whakatāne', lat: -37.9535, lon: 176.9896, region: 'Bay of Plenty' },
    { name: 'Taupō', lat: -38.6857, lon: 176.0702, region: 'Waikato' },
    { name: 'Gisborne (Tūranganui-a-Kiwa)', lat: -38.6623, lon: 178.0176, region: 'Tairāwhiti' },
    { name: 'New Plymouth (Ngāmotu)', lat: -39.0556, lon: 174.0752, region: 'Taranaki' },
    { name: 'Napier (Ahuriri)', lat: -39.4928, lon: 176.9120, region: 'Hawke’s Bay' },
    { name: 'Hastings (Heretaunga)', lat: -39.6381, lon: 176.8492, region: 'Hawke’s Bay' },
    { name: 'Whanganui', lat: -39.9301, lon: 175.0479, region: 'Manawatū-Whanganui' },
    { name: 'Palmerston North (Te Papa-i-Oea)', lat: -40.3523, lon: 175.6082, region: 'Manawatū-Whanganui' },
    { name: 'Masterton (Whakaoriori)', lat: -40.9511, lon: 175.6573, region: 'Wellington' },
    { name: 'Wellington (Te Whanganui-a-Tara)', lat: -41.2865, lon: 174.7762, region: 'Wellington' },
    { name: 'Picton (Waitohi)', lat: -41.2930, lon: 174.0019, region: 'Marlborough' },
    { name: 'Blenheim (Waiharakeke)', lat: -41.5134, lon: 173.9612, region: 'Marlborough' },
    { name: 'Nelson (Whakatū)', lat: -41.2706, lon: 173.2840, region: 'Nelson' },
    { name: 'Westport (Kawatiri)', lat: -41.7547, lon: 171.6006, region: 'West Coast' },
    { name: 'Greymouth (Māwhera)', lat: -42.4504, lon: 171.2108, region: 'West Coast' },
    { name: 'Kaikōura', lat: -42.4008, lon: 173.6814, region: 'Canterbury' },
    { name: 'Arthur’s Pass / Otira Gorge', lat: -42.9052, lon: 171.5594, region: 'Canterbury/West Coast' },
    { name: 'Christchurch (Ōtautahi)', lat: -43.5321, lon: 172.6362, region: 'Canterbury' },
    { name: 'Timaru (Te Tihi-o-Maru)', lat: -44.3904, lon: 171.2373, region: 'Canterbury' },
    { name: 'Lake Tekapo / Twizel', lat: -44.0048, lon: 170.4771, region: 'Canterbury' },
    { name: 'Wānaka', lat: -44.7032, lon: 169.1321, region: 'Otago' },
    { name: 'Queenstown (Tāhuna)', lat: -45.0312, lon: 168.6626, region: 'Otago' },
    { name: 'Dunedin (Ōtepoti)', lat: -45.8788, lon: 170.5028, region: 'Otago' },
    { name: 'Te Anau', lat: -45.4145, lon: 167.7180, region: 'Southland' },
    { name: 'Milford Sound (Piopiotahi)', lat: -44.6716, lon: 167.9256, region: 'Southland' },
    { name: 'Invercargill (Waihōpai)', lat: -46.4132, lon: 168.3538, region: 'Southland' },
    { name: 'Bluff (Motupōhue)', lat: -46.6000, lon: 168.3420, region: 'Southland' }
  ];

  // Pre-seeded realistic NZ Potholes & Slips so the app works immediately out of the box
  const SEED_HAZARDS = [
    {
      id: 'NZ-POT-1001',
      lat: -36.3642,
      lon: 174.6214,
      heading: 345,
      cardinal: 'NNW',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Left Wheel Track (Verge Side)',
      severity: 'Rim Bender',
      hazardType: 'Pothole',
      roadType: 'State Highway',
      roadName: 'SH1 Dome Valley (Northbound)',
      highwayCode: 'SH1',
      isStateHighway: true,
      isDividedRoad: false,
      wetWeatherRisk: true,
      diameterCm: 68,
      depthCm: 14,
      gForce: 2.9,
      confirmations: 9,
      confidenceScore: 98,
      accuracyM: 4.2,
      status: 'Unreported',
      timestamp: Date.now() - 1000 * 60 * 60 * 68,
      exportedAt: Date.now() - 1000 * 60 * 60 * 54,
      notes: 'Deep edge-break pothole filled with surface water in left wheel track exiting forestry truck pullout.'
    },
    {
      id: 'NZ-POT-1002',
      lat: -36.3646,
      lon: 174.6216,
      heading: 345,
      cardinal: 'NNW',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Center Lane',
      severity: 'Bump',
      hazardType: 'Pothole',
      roadType: 'State Highway',
      roadName: 'SH1 Dome Valley (Northbound)',
      highwayCode: 'SH1',
      isStateHighway: true,
      isDividedRoad: false,
      wetWeatherRisk: true,
      diameterCm: 45,
      depthCm: 9,
      gForce: 2.1,
      confirmations: 5,
      confidenceScore: 91,
      accuracyM: 5.0,
      status: 'Unreported',
      timestamp: Date.now() - 1000 * 60 * 60 * 40,
      exportedAt: null,
      notes: 'Secondary Delamination crater 40m south of primary Dome Valley blowout (Swiss Cheese Cluster).'
    },
    {
      id: 'NZ-POT-1003',
      lat: -36.3649,
      lon: 174.6218,
      heading: 345,
      cardinal: 'NNW',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Right Wheel Track (Centerline Side)',
      severity: 'Rim Bender',
      hazardType: 'Pothole',
      roadType: 'State Highway',
      roadName: 'SH1 Dome Valley (Northbound)',
      highwayCode: 'SH1',
      isStateHighway: true,
      isDividedRoad: false,
      wetWeatherRisk: false,
      diameterCm: 55,
      depthCm: 12,
      gForce: 2.6,
      confirmations: 7,
      confidenceScore: 95,
      accuracyM: 4.5,
      status: 'Exported',
      timestamp: Date.now() - 1000 * 60 * 60 * 78,
      exportedAt: Date.now() - 1000 * 60 * 60 * 62,
      notes: 'Third crater in 50m cluster; active SLA breach (>48h since NZTA export).'
    },
    {
      id: 'NZ-POT-1004',
      lat: -39.2952,
      lon: 175.7382,
      heading: 185,
      cardinal: 'S',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Left Wheel Track (Verge Side)',
      severity: 'Rim Bender',
      hazardType: 'Pothole',
      roadType: 'State Highway',
      roadName: 'SH1 Desert Road (Southbound)',
      highwayCode: 'SH1',
      isStateHighway: true,
      isDividedRoad: false,
      wetWeatherRisk: true,
      diameterCm: 74,
      depthCm: 16,
      gForce: 3.2,
      confirmations: 14,
      confidenceScore: 99,
      accuracyM: 3.8,
      status: 'Exported',
      timestamp: Date.now() - 1000 * 60 * 60 * 92,
      exportedAt: Date.now() - 1000 * 60 * 60 * 75,
      notes: 'Freeze-thaw chipseal blowout near Three Sisters; bent two alloy rims this week.'
    },
    {
      id: 'NZ-POT-1005',
      lat: -36.8565,
      lon: 174.7468,
      heading: 170,
      cardinal: 'S',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Left Wheel Track (Verge Side)',
      severity: 'Bump',
      hazardType: 'Cycleway / Shoulder',
      roadType: 'Local Sealed Road',
      roadName: 'Ponsonby Road, Auckland',
      highwayCode: null,
      isStateHighway: false,
      isDividedRoad: false,
      wetWeatherRisk: false,
      diameterCm: 38,
      depthCm: 8,
      gForce: 1.9,
      confirmations: 4,
      confidenceScore: 88,
      accuracyM: 5.5,
      status: 'Unreported',
      timestamp: Date.now() - 1000 * 60 * 60 * 18,
      exportedAt: null,
      notes: 'Sunken utility trench & bus-lane edge pothole hazardous to cyclists and scooters.'
    },
    {
      id: 'NZ-POT-1006',
      lat: -36.8332,
      lon: 175.6992,
      heading: 40,
      cardinal: 'NE',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Left Wheel Track (Verge Side)',
      severity: 'Rim Bender',
      hazardType: 'Slip / Washout / Dropout',
      roadType: 'State Highway',
      roadName: 'SH25 Kūaotunu Hill, Coromandel',
      highwayCode: 'SH25',
      isStateHighway: true,
      isDividedRoad: false,
      wetWeatherRisk: true,
      diameterCm: 120,
      depthCm: 22,
      gForce: 2.8,
      confirmations: 11,
      confidenceScore: 97,
      accuracyM: 4.9,
      status: 'Exported',
      timestamp: Date.now() - 1000 * 60 * 60 * 80,
      exportedAt: Date.now() - 1000 * 60 * 60 * 65,
      notes: 'Shoulder dropout & seal collapse encroaching into northbound left lane.'
    },
    {
      id: 'NZ-POT-1007',
      lat: -38.1282,
      lon: 178.3212,
      heading: 195,
      cardinal: 'SSW',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Center Lane',
      severity: 'Rim Bender',
      hazardType: 'Pothole',
      roadType: 'State Highway',
      roadName: 'SH35 Tokomaru Bay Approach, Tairāwhiti',
      highwayCode: 'SH35',
      isStateHighway: true,
      isDividedRoad: false,
      wetWeatherRisk: true,
      diameterCm: 82,
      depthCm: 17,
      gForce: 3.1,
      confirmations: 8,
      confidenceScore: 96,
      accuracyM: 6.1,
      status: 'Unreported',
      timestamp: Date.now() - 1000 * 60 * 60 * 30,
      exportedAt: null,
      notes: 'Logging truck rut & deep pothole across bridge abutment.'
    },
    {
      id: 'NZ-POT-1008',
      lat: -41.1146,
      lon: 175.2286,
      heading: 60,
      cardinal: 'ENE',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Right Wheel Track (Centerline Side)',
      severity: 'Bump',
      hazardType: 'Pothole',
      roadType: 'State Highway',
      roadName: 'SH2 Remutaka Hill (Featherston Descent)',
      highwayCode: 'SH2',
      isStateHighway: true,
      isDividedRoad: false,
      wetWeatherRisk: true,
      diameterCm: 48,
      depthCm: 10,
      gForce: 2.3,
      confirmations: 6,
      confidenceScore: 93,
      accuracyM: 4.7,
      status: 'Unreported',
      timestamp: Date.now() - 1000 * 60 * 60 * 24,
      exportedAt: null,
      notes: 'Apex pothole on hairpin corner; dangerous for motorcycles leaning left.'
    },
    {
      id: 'NZ-POT-1009',
      lat: -42.9054,
      lon: 171.5596,
      heading: 280,
      cardinal: 'W',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Left Wheel Track (Verge Side)',
      severity: 'Rim Bender',
      hazardType: 'Pothole',
      roadType: 'Bridge Deck',
      roadName: 'SH73 Otira Viaduct (Westbound)',
      highwayCode: 'SH73',
      isStateHighway: true,
      isDividedRoad: false,
      wetWeatherRisk: true,
      diameterCm: 62,
      depthCm: 15,
      gForce: 3.0,
      confirmations: 12,
      confidenceScore: 99,
      accuracyM: 5.2,
      status: 'Exported',
      timestamp: Date.now() - 1000 * 60 * 60 * 110,
      exportedAt: Date.now() - 1000 * 60 * 60 * 88,
      notes: 'Expansion joint asphalt failure exposing steel rebar edge.'
    },
    {
      id: 'NZ-POT-1010',
      lat: -43.5305,
      lon: 172.6012,
      heading: 90,
      cardinal: 'E',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Left Wheel Track (Verge Side)',
      severity: 'Ding',
      hazardType: 'Pothole',
      roadType: 'Local Sealed Road',
      roadName: 'Riccarton Road, Christchurch',
      highwayCode: null,
      isStateHighway: false,
      isDividedRoad: false,
      wetWeatherRisk: false,
      diameterCm: 32,
      depthCm: 6,
      gForce: 1.5,
      confirmations: 3,
      confidenceScore: 84,
      accuracyM: 3.9,
      status: 'Fixed',
      timestamp: Date.now() - 1000 * 60 * 60 * 140,
      exportedAt: Date.now() - 1000 * 60 * 60 * 120,
      fixedAt: Date.now() - 1000 * 60 * 60 * 12,
      notes: 'Patched with hot-mix asphalt by Christchurch City Council contractor.'
    },
    {
      id: 'NZ-POT-1011',
      lat: -44.7644,
      lon: 167.9893,
      heading: 300,
      cardinal: 'WNW',
      laneSide: 'Left-Hand Lane (LHL)',
      wheelTrack: 'Center Lane',
      severity: 'Rim Bender',
      hazardType: 'Pothole',
      roadType: 'State Highway',
      roadName: 'SH94 Homer Tunnel East Portal Approach',
      highwayCode: 'SH94',
      isStateHighway: true,
      isDividedRoad: false,
      wetWeatherRisk: true,
      diameterCm: 70,
      depthCm: 18,
      gForce: 3.3,
      confirmations: 10,
      confidenceScore: 97,
      accuracyM: 7.4,
      status: 'Unreported',
      timestamp: Date.now() - 1000 * 60 * 60 * 36,
      exportedAt: null,
      notes: 'Snow-chain & avalanche meltwater crater directly outside Homer Tunnel entrance.'
    }
  ];

  // Haversine distance in meters
  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Resolve nearest NZ Territorial Authority + State Highway + RAMM RS/RP reference
  function resolveJurisdiction(lat, lon, roadHint = '', isStateHighwayOverride = null) {
    let bestCouncil = COUNCILS[3]; // Default Auckland if out at sea
    let minCouncilDist = Infinity;

    for (const c of COUNCILS) {
      const d = haversineMeters(lat, lon, c.lat, c.lon);
      if (d < minCouncilDist) {
        minCouncilDist = d;
        bestCouncil = c;
      }
    }

    // Check proximity to State Highway network & compute RAMM RS/RP
    let nearestSH = null;
    let minSHDistM = Infinity;
    let bestRammRS = 0;
    let bestRammRP = 0;
    let isDivided = false;

    for (const sh of STATE_HIGHWAYS) {
      for (let i = 0; i < sh.waypoints.length; i++) {
        const wp = sh.waypoints[i];
        const d = haversineMeters(lat, lon, wp.lat, wp.lon);
        if (d < minSHDistM) {
          minSHDistM = d;
          nearestSH = sh;
          bestRammRS = wp.rammRS;
          bestRammRP = Number(((d % 15000) / 1000).toFixed(2));
        }
      }
    }

    const hintMatchesSH = /\bSH\s*\d+/i.test(roadHint || '');
    const isSH =
      isStateHighwayOverride !== null
        ? isStateHighwayOverride
        : hintMatchesSH || minSHDistM < 3200;

    if (nearestSH) {
      for (const seg of nearestSH.dividedSegments || []) {
        if (lat >= seg.minLat && lat <= seg.maxLat) {
          isDivided = true;
          break;
        }
      }
    }

    const shCode = hintMatchesSH
      ? roadHint.match(/\b(SH\s*\d+)/i)[1].replace(/\s+/g, '').toUpperCase()
      : nearestSH
      ? nearestSH.code
      : 'SH1';

    const rammRef = isSH
      ? `${shCode}-RS${String(bestRammRS).padStart(4, '0')}/RP${bestRammRP.toFixed(2)}`
      : `${bestCouncil.id}-RAMM-${Math.abs(Math.round(lat * 100))}/${Number((minCouncilDist / 1000).toFixed(2))}`;

    const primaryAgency = isSH ? NZTA_AGENCY : bestCouncil;

    return {
      isStateHighway: isSH,
      highwayCode: isSH ? shCode : null,
      isDividedRoad: isDivided,
      rammRef,
      council: bestCouncil,
      primaryAgency: {
        id: primaryAgency.id,
        name: primaryAgency.name,
        email: primaryAgency.email,
        phone: primaryAgency.phone,
        slaHours: primaryAgency.slaHours,
        contractor: primaryAgency.contractor,
        ward: bestCouncil.ward,
        councillorEmail: bestCouncil.councillor
      }
    };
  }

  return {
    NZTA_AGENCY,
    COUNCILS,
    STATE_HIGHWAYS,
    TOWNS,
    SEED_HAZARDS,
    haversineMeters,
    resolveJurisdiction
  };
})();
