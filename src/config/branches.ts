/**
 * BIO-NEXA Central Educational Branch Configuration
 * 
 * Supports multiple life science and allied science disciplines.
 * Configured centrally so new branches can be added without rewriting portal code.
 */

export interface EducationalBranch {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: 'core_biotech' | 'applied_sciences' | 'chemical_pharma' | 'natural_sciences';
  keywords: string[];
  eligibleDegrees: string[];
}

export const EDUCATIONAL_BRANCHES: EducationalBranch[] = [
  {
    id: 'biotechnology',
    name: 'Biotechnology',
    shortName: 'Biotech',
    description: 'Genetic engineering, CRISPR, molecular biology, recombinant DNA, and industrial fermentation.',
    category: 'core_biotech',
    keywords: [
      'biotechnology', 'biotech', 'crispr', 'molecular biology', 'fermentation', 'bioprocess',
      'recombinant', 'cloning', 'cell culture', 'mammalian cell', 'upstream', 'downstream',
      'monoclonal antibody', 'biosimilar', 'genomics', 'western blot', 'elisa', 'plasmid'
    ],
    eligibleDegrees: ['B.Tech Biotechnology', 'B.Sc Biotechnology', 'M.Sc Biotechnology', 'M.Tech Biotechnology', 'Ph.D Biotechnology']
  },
  {
    id: 'microbiology',
    name: 'Microbiology',
    shortName: 'Microbio',
    description: 'Bacteriology, virology, mycology, environmental, industrial, and clinical microbiology.',
    category: 'applied_sciences',
    keywords: [
      'microbiology', 'microbiologist', 'bacteria', 'fungi', 'sterility', 'endotoxin',
      'pathogen', 'culture media', 'gram stain', 'bioburden', 'aseptic', 'microbial', 'antimicrobial'
    ],
    eligibleDegrees: ['B.Sc Microbiology', 'M.Sc Microbiology', 'M.Sc Medical Microbiology', 'Ph.D Microbiology']
  },
  {
    id: 'food_technology',
    name: 'Food Technology',
    shortName: 'Food Tech',
    description: 'Food processing, dairy technology, quality assurance, HACCP, FSSAI compliance, and nutraceuticals.',
    category: 'applied_sciences',
    keywords: [
      'food technology', 'food tech', 'food science', 'dairy technology', 'haccp', 'fssai',
      'food processing', 'nutraceutical', 'sensory evaluation', 'food packaging', 'food safety',
      'shelf life', 'pasteurization', 'fermented foods'
    ],
    eligibleDegrees: ['B.Tech Food Technology', 'B.Sc Food Science', 'M.Tech Food Technology', 'M.Sc Food Processing']
  },
  {
    id: 'biochemistry',
    name: 'Biochemistry',
    shortName: 'Biochem',
    description: 'Enzymology, protein purification, metabolic engineering, and clinical biochemistry.',
    category: 'applied_sciences',
    keywords: [
      'biochemistry', 'biochemist', 'enzyme', 'enzymology', 'protein purification',
      'chromatography', 'metabolism', 'kinetics', 'spectrophotometry', 'hplc', 'mass spectrometry'
    ],
    eligibleDegrees: ['B.Sc Biochemistry', 'M.Sc Biochemistry', 'M.Sc Medical Biochemistry', 'Ph.D Biochemistry']
  },
  {
    id: 'bioinformatics',
    name: 'Bioinformatics',
    shortName: 'Bioinfo',
    description: 'Computational biology, NGS data pipelines, structural biology, docking, and multi-omics.',
    category: 'core_biotech',
    keywords: [
      'bioinformatics', 'computational biology', 'ngs', 'next generation sequencing', 'rna-seq',
      'python for biology', 'biopython', 'blast', 'molecular docking', 'rosetta', 'bioconductor',
      'variant calling', 'genome assembly', 'pymol'
    ],
    eligibleDegrees: ['B.Tech Bioinformatics', 'M.Sc Bioinformatics', 'M.Tech Bioinformatics', 'Ph.D Computational Biology']
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    shortName: 'Pharma',
    description: 'Pharmaceutical chemistry, pharmacology, drug formulation, regulatory affairs, and QA/QC.',
    category: 'chemical_pharma',
    keywords: [
      'pharmacy', 'pharmaceutical', 'pharmacology', 'b.pharm', 'm.pharm', 'formulation',
      'regulatory affairs', 'dissolution', 'ich guidelines', 'usfda', 'gmp', 'active pharmaceutical ingredient', 'api'
    ],
    eligibleDegrees: ['B.Pharm', 'M.Pharm', 'Pharm.D', 'Ph.D Pharmaceutical Sciences']
  },
  {
    id: 'medical_lab_tech',
    name: 'Medical Laboratory Technology',
    shortName: 'MLT',
    description: 'Clinical pathology, hematology, histopathology, diagnostic assays, and medical microbiology.',
    category: 'applied_sciences',
    keywords: [
      'medical lab technology', 'mlt', 'dmlt', 'bmlt', 'clinical laboratory', 'hematology',
      'histopathology', 'phlebotomy', 'clinical pathology', 'diagnostic laboratory', 'blood bank'
    ],
    eligibleDegrees: ['B.Sc MLT', 'M.Sc MLT', 'DMLT', 'B.Sc Medical Laboratory Technology']
  },
  {
    id: 'agriculture',
    name: 'Agriculture',
    shortName: 'Agri',
    description: 'Agricultural biotechnology, plant breeding, agronomy, soil science, and seed technology.',
    category: 'applied_sciences',
    keywords: [
      'agriculture', 'agri-biotech', 'plant breeding', 'seed technology', 'agronomy',
      'soil science', 'crop protection', 'tissue culture', 'plant genetics', 'icar', 'transgenic'
    ],
    eligibleDegrees: ['B.Sc Agriculture', 'M.Sc Agriculture', 'M.Sc Plant Biotechnology', 'Ph.D Agriculture']
  },
  {
    id: 'life_sciences',
    name: 'Life Sciences',
    shortName: 'Life Sci',
    description: 'Interdisciplinary biology, physiology, ecology, evolutionary biology, and CSIR NET subjects.',
    category: 'natural_sciences',
    keywords: [
      'life sciences', 'biological sciences', 'biology', 'csir net life sciences', 'physiology',
      'developmental biology', 'immunology', 'ecology', 'evolution', 'genetics'
    ],
    eligibleDegrees: ['B.Sc Life Sciences', 'M.Sc Life Sciences', 'Integrated M.Sc-Ph.D Life Sciences']
  },
  {
    id: 'zoology',
    name: 'Zoology',
    shortName: 'Zoology',
    description: 'Animal physiology, wildlife biology, entomology, parasitology, and aquaculture.',
    category: 'natural_sciences',
    keywords: [
      'zoology', 'animal biology', 'entomology', 'parasitology', 'aquaculture', 'fisheries',
      'animal cell culture', 'wildlife', 'animal models', 'toxicology'
    ],
    eligibleDegrees: ['B.Sc Zoology', 'M.Sc Zoology', 'Ph.D Zoology']
  },
  {
    id: 'botany',
    name: 'Botany',
    shortName: 'Botany',
    description: 'Plant sciences, plant physiology, ethnobotany, phytochemistry, and plant tissue culture.',
    category: 'natural_sciences',
    keywords: [
      'botany', 'plant biology', 'plant physiology', 'phytochemistry', 'plant tissue culture',
      'medicinal plants', 'herbarium', 'algae', 'bryology', 'plant biotechnology'
    ],
    eligibleDegrees: ['B.Sc Botany', 'M.Sc Botany', 'Ph.D Botany']
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    shortName: 'Chemistry',
    description: 'Organic synthesis, analytical chemistry, medicinal chemistry, and spectroscopy.',
    category: 'chemical_pharma',
    keywords: [
      'chemistry', 'organic chemistry', 'analytical chemistry', 'medicinal chemistry',
      'synthesis', 'spectroscopy', 'nmr', 'gc-ms', 'hplc', 'purification', 'titration'
    ],
    eligibleDegrees: ['B.Sc Chemistry', 'M.Sc Chemistry', 'M.Sc Analytical Chemistry', 'Ph.D Chemistry']
  },
  {
    id: 'environmental_science',
    name: 'Environmental Science',
    shortName: 'Env Sci',
    description: 'Bioremediation, environmental monitoring, waste management, EIA, and sustainability.',
    category: 'applied_sciences',
    keywords: [
      'environmental science', 'bioremediation', 'waste management', 'effluent treatment',
      'etp', 'air quality', 'water quality', 'pollution control', 'environmental impact assessment', 'eia'
    ],
    eligibleDegrees: ['B.Sc Environmental Science', 'M.Sc Environmental Science', 'Ph.D Environmental Science']
  }
];

/**
 * Matches an opportunity's textual details against central educational branches.
 * Strict: only matches if supported by explicit title, keywords, qualifications, or description.
 */
export function matchBranchesForOpportunity(
  titleOrObj: string | { title?: string; description?: string; qualifications?: string[]; skills?: string[] },
  descArg: string = '',
  qualificationsArg: string[] = [],
  skillsArg: string[] = []
): string[] {
  let title = '';
  let description = '';
  let qualifications: string[] = [];
  let skills: string[] = [];

  if (typeof titleOrObj === 'object' && titleOrObj !== null) {
    title = titleOrObj.title || '';
    description = titleOrObj.description || '';
    qualifications = titleOrObj.qualifications || [];
    skills = titleOrObj.skills || [];
  } else {
    title = titleOrObj || '';
    description = descArg || '';
    qualifications = qualificationsArg || [];
    skills = skillsArg || [];
  }

  const combinedText = `${title} ${description} ${qualifications.join(' ')} ${skills.join(' ')}`.toLowerCase();
  const matchedBranchIds: string[] = [];

  for (const branch of EDUCATIONAL_BRANCHES) {
    // Check degree matches
    const hasDegreeMatch = branch.eligibleDegrees.some(deg =>
      combinedText.includes(deg.toLowerCase())
    );

    // Check keyword matches
    const keywordMatches = branch.keywords.filter(kw =>
      combinedText.includes(kw.toLowerCase())
    );

    // If degree matches OR at least 2 relevant branch keywords are present (or strong 1 keyword in title)
    const titleLower = title.toLowerCase();
    const titleMatch = branch.keywords.some(kw => titleLower.includes(kw.toLowerCase()));

    if (hasDegreeMatch || titleMatch || keywordMatches.length >= 2) {
      matchedBranchIds.push(branch.id);
    }
  }

  // Fallback: If nothing specifically matched but contains general biotech/life science keywords
  if (matchedBranchIds.length === 0) {
    if (combinedText.includes('biotech') || combinedText.includes('dna') || combinedText.includes('lab')) {
      matchedBranchIds.push('biotechnology');
    } else {
      matchedBranchIds.push('life_sciences');
    }
  }

  return matchedBranchIds;
}

/**
 * Returns branch metadata by branch ID
 */
export function getBranchById(id: string): EducationalBranch | undefined {
  return EDUCATIONAL_BRANCHES.find(b => b.id === id);
}

/**
 * Returns branch display name
 */
export function getBranchName(id: string): string {
  const branch = getBranchById(id);
  return branch ? branch.name : id;
}
