import { Job, Internship, Course, Exam, Scholarship, ResearchPaper, DiscussionTopic, Mentor, NewsArticle, Certificate, ExternalSyncLog, ReportItem } from '../types';

export const SEED_JOBS: Job[] = [
  {
    id: 'job-1',
    slug: 'senior-bioprocess-scientist-biocon',
    title: 'Senior Bioprocess Scientist - Upstream Fermentation',
    company: 'Biocon Biologics',
    companyLogo: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=120&h=120&q=80',
    location: 'Bengaluru, Karnataka',
    type: 'Full-time',
    sector: 'Private Biopharma',
    experienceLevel: 'Mid-level (2-5 yrs)',
    qualification: 'M.Sc / M.Tech',
    salary: '₹10,50,000 - ₹14,00,000 / yr',
    postedDate: '2026-11-01',
    deadline: '2026-12-15',
    description: 'Lead upstream mammalian and microbial fermentation development for biosimilar monoclonal antibodies in 200L to 1000L Single-Use Bioreactors (SUB).',
    responsibilities: [
      'Design and execute scale-up experiments using Sartorius and Cytiva bioreactor platforms',
      'Optimize media composition, feed strategies, and critical process parameters (DO, pH, sparging)',
      'Conduct metabolic flux analyses (glucose, lactate, amino acid profiles) via HPLC and BioProfile analyzers',
      'Author technology transfer documents and process validation protocols adhering to ICH Q8/Q9 guidelines'
    ],
    requirements: [
      'M.Sc or M.Tech in Biotechnology, Biochemical Engineering, or Industrial Microbiology',
      '2+ years hands-on experience running bench-scale to pilot-scale fermenters',
      'Strong grasp of cGMP standards and cleanroom operations (Grade C/D)',
      'Demonstrated expertise in statistical Design of Experiments (DoE) using JMP or Design-Expert'
    ],
    skills: ['Bioreactors', 'Fermentation', 'DoE', 'cGMP', 'Mammalian Cell Culture', 'HPLC'],
    source: { name: 'Biocon Careers Portal', url: 'https://www.biocon.com/careers/job-openings', isExternal: true },
    applicationUrl: 'https://www.biocon.com/careers/job-openings',
    featured: true
  },
  {
    id: 'job-2',
    slug: 'molecular-biology-research-associate-csir-igib',
    title: 'Project Research Scientist I - CRISPR Diagnostics',
    company: 'CSIR - Institute of Genomics & Integrative Biology (IGIB)',
    companyLogo: 'https://images.unsplash.com/photo-1579165466791-78822231267f?auto=format&fit=crop&w=120&h=120&q=80',
    location: 'New Delhi',
    type: 'Contract',
    sector: 'Government / Autonomous',
    experienceLevel: 'Fresher (0-1 yr)',
    qualification: 'M.Sc / M.Tech',
    salary: '₹56,000 / month + 27% HRA (as per DST norms)',
    postedDate: '2026-10-28',
    deadline: '2026-11-25',
    description: 'Work on cutting-edge Cas12/Cas13 based SHERLOCK & FELUDA point-of-care diagnostic biosensors for infectious genetic markers.',
    responsibilities: [
      'Synthesize guide RNAs (crRNA) and express recombinant Cas endonucleases in E. coli',
      'Perform RT-RPA, LAMP, and RT-qPCR assays alongside lateral flow strip readout optimization',
      'Validate sensitivity and limit of detection (LoD) using spiked clinical respiratory matrices',
      'Maintain detailed electronic lab notebooks (ELN) for CSIR and ICMR progress reports'
    ],
    requirements: [
      'M.Sc in Biotechnology / Life Sciences / Genetics with NET / GATE qualification',
      'Sound foundation in nucleic acid extraction, primer design, and in vitro transcription',
      'Proficiency in recombinant protein purification (Ni-NTA affinity chromatography)',
      'Attention to biosafety (BSL-2 protocols)'
    ],
    skills: ['CRISPR-Cas', 'RT-qPCR', 'Protein Purification', 'LAMP', 'Cloning', 'Gel Electrophoresis'],
    benefits: ['Government Fellowship Norms', 'Access to High-Performance Illumina Sequencers', 'Contributory Medical Scheme'],
    source: { name: 'CSIR IGIB Official Notification', url: 'https://www.igib.res.in/career/project-vacancies', isExternal: true },
    applicationUrl: 'https://www.igib.res.in/career/project-vacancies',
    featured: true
  },
  {
    id: 'job-3',
    slug: 'quality-control-analyst-serum-institute',
    title: 'QC Associate - Vaccine Release Testing & HPLC',
    company: 'Serum Institute of India (SII)',
    companyLogo: 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=120&h=120&q=80',
    location: 'Pune, Maharashtra',
    type: 'Full-time',
    sector: 'Private Biopharma',
    experienceLevel: 'Mid-level (2-5 yrs)',
    qualification: 'B.Sc / B.Tech',
    salary: '₹6,50,000 - ₹8,50,000 / yr',
    postedDate: '2026-10-30',
    deadline: '2026-12-10',
    description: 'Execute analytical release testing for pediatric and recombinant conjugate vaccines including sterility, endotoxin (LAL), and antigen purity.',
    responsibilities: [
      'Operate Waters HPLC and UHPLC systems for polysaccharide content and peptide mapping',
      'Perform micro-plate ELISA, SDS-PAGE, and western blotting for identity confirmation',
      'Perform USP/EP endotoxin testing via kinetic chromogenic LAL assays',
      'Document deviations, OOS, and CAPAs in accordance with US FDA 21 CFR Part 211'
    ],
    requirements: [
      'B.Sc or B.Tech in Biotechnology, Biochemistry, or Pharmacy',
      '1 to 4 years experience in a regulated vaccine or sterile injectable QC laboratory',
      'Familiarity with Empower 3 chromatography software and LIMS',
      'Strict adherence to ALCOA+ data integrity guidelines'
    ],
    skills: ['HPLC', 'ELISA', 'LAL Endotoxin', 'cGMP', 'SDS-PAGE', '21 CFR Part 11'],
    benefits: ['Subsidized Transportation', 'Annual Performance Incentive', 'Comprehensive Medical Coverage'],
    source: { name: 'Serum Institute Human Resources', url: 'https://www.seruminstitute.com/careers.php', isExternal: true },
    applicationUrl: 'https://www.seruminstitute.com/careers.php'
  },
  {
    id: 'job-4',
    slug: 'bioinformatics-pipeline-developer-syngene',
    title: 'Bioinformatics Analyst - Single-Cell & Spatial Transcriptomics',
    company: 'Syngene International',
    companyLogo: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=120&h=120&q=80',
    location: 'Bengaluru / Hyderabad (Hybrid)',
    type: 'Full-time',
    sector: 'Diagnostics & CRO',
    experienceLevel: 'Mid-level (2-5 yrs)',
    qualification: 'M.Sc / M.Tech',
    salary: '₹9,00,000 - ₹12,50,000 / yr',
    postedDate: '2026-11-02',
    deadline: '2026-12-20',
    description: 'Analyze 10x Genomics scRNA-seq and Visium spatial transcriptomics datasets for international oncology drug discovery collaborators.',
    responsibilities: [
      'Deploy automated Nextflow and Snakemake pipelines on AWS cloud computing clusters',
      'Execute cell clustering, trajectory inference, and differential gene expression with Seurat and Scanpy',
      'Perform ligand-receptor cell-cell interaction modeling using CellChat and CellPhoneDB',
      'Present biological insights and interactive dashboards to client discovery teams'
    ],
    requirements: [
      'M.Sc or M.Tech in Bioinformatics, Computational Biology, or Genomics',
      'Proficiency in R and Python for biostatistics and data visualization',
      'Solid command of Linux bash shell scripting, Git, and containerization (Docker/Singularity)',
      'Understanding of immune cell marker biology and cancer hallmarks'
    ],
    skills: ['R / Seurat', 'Python / Scanpy', 'Nextflow', 'scRNA-seq', 'AWS', 'Linux Bash'],
    benefits: ['Flexible Work Model', 'Broadband Allowance', 'Skill Upskilling Stipend', 'Stock Options'],
    source: { name: 'Syngene Careers', url: 'https://www.syngeneintl.com/careers/', isExternal: true },
    applicationUrl: 'https://www.syngeneintl.com/careers/'
  },
  {
    id: 'job-5',
    slug: 'scientist-cell-line-development-dr-reddys',
    title: 'Scientist - Mammalian Cell Line Engineering (CHO)',
    company: "Dr. Reddy's Laboratories",
    companyLogo: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=120&h=120&q=80',
    location: 'Hyderabad, Telangana',
    type: 'Full-time',
    sector: 'Private Biopharma',
    experienceLevel: 'Senior (5+ yrs)',
    qualification: 'Ph.D / Postdoc',
    salary: '₹18,00,000 - ₹24,00,000 / yr',
    postedDate: '2026-10-25',
    deadline: '2026-11-30',
    description: 'Lead host cell engineering (CHO-K1, DG44) utilizing targeted integration platforms (site-specific recombinases) for high-titer biologics production.',
    responsibilities: [
      'Oversee stable pool generation, single-cell cloning via Beacon optofluidic system, and clone stability studies',
      'Implement genetic modifications to suppress apoptosis and modulate N-glycosylation pathways',
      'Direct cross-functional tech-transfer to Upstream Pilot Bioreactor teams',
      'Mentor junior researchers and author patent disclosures'
    ],
    requirements: [
      'Ph.D in Biotechnology, Molecular Biology, or Cellular Genetics with 2+ years postdoctoral or industrial track record',
      'Deep expertise in mammalian vector construction, transfection methods, and genomic characterization',
      'Experience with FACS cell sorting and high-throughput colony screening',
      'Record of peer-reviewed publications or patent filings in mammalian cell engineering'
    ],
    skills: ['CHO Cell Lines', 'Vector Design', 'FACS', 'Optofluidics', 'Molecular Cloning', 'Glycosylation'],
    benefits: ['Executive Health Package', 'Annual Performance Equity', 'Relocation & Housing Support'],
    source: { name: "Dr. Reddy's Talent Acquisition", url: 'https://careers.drreddys.com', isExternal: true },
    applicationUrl: 'https://careers.drreddys.com',
    featured: true
  }
];

export const SEED_INTERNSHIPS: Internship[] = [
  {
    id: 'intern-1',
    slug: 'iasc-summer-research-fellowship-2027',
    title: 'Indian Academy of Sciences (IASc-INSA-NASI) Summer Research Fellowship',
    organization: 'Indian Institute of Science (IISc) / IASc Bengaluru',
    location: 'Bengaluru / Pan-India Host Labs',
    mode: 'On-site Lab',
    stipend: '₹12,000 / month + Round-trip Train Travel',
    duration: '2 Months (May - July 2027)',
    deadline: '2026-11-30',
    category: 'Summer Fellowship',
    eligibility: 'Open to B.Sc (2nd/3rd yr), B.Tech (2nd/3rd yr), M.Sc (1st yr) students with minimum 65% aggregate.',
    description: 'Prestigious national fellowship pairing undergraduate and postgraduate students with premier academy fellows in molecular genetics, structural biology, and biochemistry.',
    learningOutcomes: [
      'Independent hands-on research project under the direct guidance of a National Academy Fellow',
      'Technique mastery in protein crystallography, cryo-EM sample prep, or yeast genetics',
      'Formal technical writing experience culminating in an Academy Fellowship monograph'
    ],
    skillsRequired: ['Basic Lab Calculations', 'Buffer Preparation', 'Molecular Biology Fundamentals', 'Curiosity'],
    source: { name: 'Indian Academy of Sciences Web Portal', url: 'https://web-japps.ias.ac.in/fellowship2027/', isExternal: true },
    applicationUrl: 'https://web-japps.ias.ac.in/fellowship2027/',
    featured: true
  },
  {
    id: 'intern-2',
    slug: 'biocon-academy-industrial-r-d-intern',
    title: 'Biocon Academy - Industrial Fermentation & Analytics Trainee',
    organization: 'Biocon Academy',
    location: 'Electronic City, Bengaluru',
    mode: 'On-site Lab',
    stipend: '₹18,00,0 / month + Subsidized Accommodation',
    duration: '6 Months (Jan - June 2027)',
    deadline: '2026-12-10',
    category: 'Industrial R&D',
    eligibility: 'Final semester M.Sc / B.Tech / M.Tech in Biotechnology, Microbiology, or Chemical Engineering.',
    description: 'Immersive six-month industrial internship bridging academia and biopharma manufacturing. Gain hands-on exposure to pilot-scale fermenters and downstream chromatography skids.',
    learningOutcomes: [
      'Operational training on 50L fed-batch bioreactors and downstream ÄKTA pure chromatography',
      'Exposure to cGMP documentation, deviation handling, and audit readiness',
      'Fast-track placement opportunity into Biocon full-time Associate positions upon completion'
    ],
    skillsRequired: ['Aseptic Technique', 'Basic Chromatography', 'Data Analysis in Excel', 'Standard Operating Procedures'],
    source: { name: 'Biocon Academy Programs', url: 'https://www.bioconacademy.com/admissions.html', isExternal: true },
    applicationUrl: 'https://www.bioconacademy.com/admissions.html',
    featured: true
  },
  {
    id: 'intern-3',
    slug: 'ncbs-tifr-annual-dissertation-project',
    title: 'NCBS-TIFR Postgraduate Dissertation Trainee - Neurogenetics',
    organization: 'National Centre for Biological Sciences (NCBS-TIFR)',
    location: 'Bengaluru, Karnataka',
    mode: 'On-site Lab',
    stipend: '₹10,000 / month (Institutional Contingency)',
    duration: '6 Months to 1 Year',
    deadline: '2026-12-05',
    category: 'Academic Dissertation',
    eligibility: 'M.Sc students in their final year requiring an institutional thesis project.',
    description: 'Join the cellular and molecular neurobiology laboratories at NCBS to investigate synaptic plasticity and neurodegeneration in Drosophila melanogaster and zebrafish models.',
    learningOutcomes: [
      'Confocal fluorescence microscopy and live-cell calcium imaging',
      'CRISPR-Cas9 mediated gene knockouts in model organisms',
      'Presentation of findings at NCBS weekly campus research seminars'
    ],
    skillsRequired: ['Confocal Microscopy Basics', 'Genetics', 'Dissection Skills', 'Scientific Literature Reading'],
    source: { name: 'NCBS Academic Office', url: 'https://www.ncbs.res.in/academic/admissions', isExternal: true },
    applicationUrl: 'https://www.ncbs.res.in/academic/admissions'
  },
  {
    id: 'intern-4',
    slug: 'reliance-life-sciences-regenerative-intern',
    title: 'Research Intern - Stem Cell & Regenerative Medicine',
    organization: 'Reliance Life Sciences',
    location: 'Navi Mumbai, Maharashtra',
    mode: 'On-site Lab',
    stipend: '₹15,000 / month',
    duration: '4 Months',
    deadline: '2026-12-18',
    category: 'Industrial R&D',
    eligibility: 'Students pursuing M.Sc / M.Tech in Stem Cell Biology, Biotechnology, or Biomedical Sciences.',
    description: 'Hands-on training in mesenchymal stem cell (MSC) expansion, characterization via flow cytometry, and cryopreservation banking protocols.',
    learningOutcomes: [
      'Primary human tissue isolation and cell culture under cleanroom conditions',
      'Tri-lineage differentiation assays (osteogenic, chondrogenic, adipogenic)',
      'Flow cytometry staining and data interpretation'
    ],
    skillsRequired: ['Tissue Culture', 'Sterile Handling', 'Immunocytochemistry', 'Biosafety'],
    source: { name: 'Reliance Life Sciences Careers', url: 'https://www.rellife.com/careers.html', isExternal: true },
    applicationUrl: 'https://www.rellife.com/careers.html'
  }
];

export const SEED_COURSES: Course[] = [
  {
    id: 'course-1',
    slug: 'crispr-cas9-molecular-gene-editing-masterclass',
    title: 'CRISPR-Cas9 & Precision Gene Editing: Theory to Bench Protocol',
    instructor: 'Dr. Arindam Sen, Ph.D.',
    instructorTitle: 'Former Senior Scientist at CSIR-IGIB, Principal Investigator',
    level: 'Intermediate',
    duration: '14 Hours (Self-paced)',
    lessonsCount: 6,
    rating: 4.9,
    studentsCount: 2840,
    category: 'Molecular Biology & CRISPR',
    overview: 'A rigorous masterclass covering CRISPR mechanisms, sgRNA design algorithms (CRISPOR, CHOPCHOP), off-target minimization, Cas variants (dCas9, Prime Editing, Base Editing), and bench protocol design.',
    syllabus: [
      'Module 1: Evolution of Genomic Editing - From Zinc Fingers to Cas9/Cas12',
      'Module 2: The sgRNA Design Engine - Thermodynamic folding, GC content, and Off-target scoring',
      'Module 3: Delivery Systems - Electroporation, AAV viral vectors, and Lipid Nanoparticles (LNPs)',
      'Module 4: Validation Assays - T7 Endonuclease 1 (T7E1), Sanger deconvolution (TIDE/ICE), and NGS Amplicon-seq',
      'Module 5: Therapeutic Applications - Ex-vivo CAR-T editing and in-vivo liver editing (Casgevy case study)',
      'Module 6: Capstone Protocol Drafting and Certification Assessment'
    ],
    lessons: [
      {
        id: 'c1-l1',
        title: 'CRISPR Type II Mechanism & Protospacer Adjacent Motif (PAM) Recognition',
        duration: '42 mins',
        videoUrl: 'https://www.youtube.com/embed/4YKFw2KZA5o',
        summary: 'Explore Streptococcus pyogenes Cas9 structure, REC and NUC lobes, R-loop formation, and 5-NGG-3 PAM binding kinetics.',
        notesMarkdown: 'Key Concept: SpCas9 requires a 5\'-NGG-3\' PAM sequence immediately 3\' of the 20-nucleotide target DNA. Cleavage generates blunt ends 3 base pairs upstream of the PAM.'
      },
      {
        id: 'c1-l2',
        title: 'Designing High-Efficiency sgRNA using CRISPOR & NCBI RefSeq',
        duration: '55 mins',
        videoUrl: 'https://www.youtube.com/embed/jAhjPd4uNFY',
        summary: 'Step-by-step computational tutorial selecting non-overlapping guide sequences targeting exon boundaries for knockout generation.',
        notesMarkdown: 'Rule of Thumb: Target the first 30-50% of the protein-coding sequence to ensure truncation upon non-homologous end joining (NHEJ) frameshift.'
      },
      {
        id: 'c1-l3',
        title: 'Repair Pathways: NHEJ vs Homology Directed Repair (HDR)',
        duration: '48 mins',
        videoUrl: 'https://www.youtube.com/embed/2pp17E4E-O8',
        summary: 'Understand cell cycle dependence (S/G2 phase for HDR), single-stranded donor oligonucleotides (ssODN) design, and donor arm lengths.',
        notesMarkdown: 'HDR requires homologous repair templates. Designing asymmetric homology arms (36 bp on PAM-distal side, 91 bp on PAM-proximal side) enhances knock-in yields.'
      }
    ],
    quiz: [
      {
        id: 'q1',
        question: 'What is the canonical Protospacer Adjacent Motif (PAM) recognized by Streptococcus pyogenes Cas9 (SpCas9)?',
        options: ['5\'-TTTV-3\'', '5\'-NGG-3\'', '5\'-NNGRRT-3\'', '5\'-AATG-3\''],
        correctAnswer: 1,
        explanation: 'Canonical SpCas9 recognizes a 5\'-NGG-3\' PAM motif located immediately 3\' to the 20-nucleotide target protospacer on the non-target DNA strand.'
      },
      {
        id: 'q2',
        question: 'At which position relative to the PAM does SpCas9 typically induce a double-strand break (DSB)?',
        options: ['10 bp upstream', 'Exactly at the PAM site', '3 bp upstream of the PAM', '5 bp downstream of the PAM'],
        correctAnswer: 2,
        explanation: 'SpCas9 HNH and RuvC endonuclease domains cut both strands approximately 3 base pairs upstream of the PAM sequence.'
      },
      {
        id: 'q3',
        question: 'Which endogenous cellular repair pathway predominates during G1 phase and often results in insertion/deletion (indel) mutations?',
        options: ['Homology Directed Repair (HDR)', 'Non-Homologous End Joining (NHEJ)', 'Base Excision Repair (BER)', 'Mismatch Repair (MMR)'],
        correctAnswer: 1,
        explanation: 'NHEJ operates across all cell cycle phases (including G1) and ligates broken ends without a template, frequently inducing frameshift indels.'
      },
      {
        id: 'q4',
        question: 'Which method uses an endonuclease to specifically cleave heteroduplex DNA formed by annealing mutant and wild-type amplicons?',
        options: ['Western Blotting', 'T7 Endonuclease I (T7E1) Assay', 'Northern Blotting', 'ELISA'],
        correctAnswer: 1,
        explanation: 'T7E1 specifically recognizes and cleaves non-perfectly matched DNA mismatches, making it standard for confirming NHEJ indels.'
      },
      {
        id: 'q5',
        question: 'How does "Base Editing" differ from classical Cas9 knockout?',
        options: [
          'It deletes entire chromosomes',
          'It uses catalytically impaired Cas9 fused to a deaminase to convert single bases without making double-strand breaks',
          'It requires radioactive isotopes',
          'It works only in prokaryotic plasmids'
        ],
        correctAnswer: 1,
        explanation: 'Base editors (Cytosine or Adenine Base Editors) tether a deaminase enzyme to nickase Cas9 (nCas9) to install point mutations cleanly without generating cytotoxic DSBs.'
      }
    ],
    featured: true
  },
  {
    id: 'course-2',
    slug: 'industrial-bioprocess-fermentation-technology',
    title: 'Industrial Bioprocess Technology: Upstream to Downstream Scale-Up',
    instructor: 'Dr. Meenakshi Ramanathan',
    instructorTitle: 'Former VP of Bioprocess at Shasun & Biocon Consultant',
    level: 'Advanced',
    duration: '18 Hours (Self-paced)',
    lessonsCount: 8,
    rating: 4.8,
    studentsCount: 1920,
    category: 'Bioprocess & Fermentation',
    overview: 'Master industrial fermentation kinetics, oxygen mass transfer coefficients (kLa), fed-batch optimization, and downstream chromatography (Protein A, IEX, HIC) for recombinant therapeutics.',
    syllabus: [
      'Module 1: Microbial vs Mammalian Bioprocess Kinetics (Monod & Luedeking-Piret models)',
      'Module 2: Bioreactor Aeration, Agitation & kLa Determination (Dynamic gassing-out method)',
      'Module 3: Continuous & Fed-Batch Feeding Strategies (Exponential, DO-stat, pH-stat)',
      'Module 4: Harvest & Primary Clarification (Centrifugation, Depth Filtration, TFF)',
      'Module 5: Downstream Purification Strategies: Capture, Intermediate, and Polishing Columns',
      'Module 6: Industrial Cleaning-in-Place (CIP) and Sterilization-in-Place (SIP) Validation'
    ],
    lessons: [
      {
        id: 'c2-l1',
        title: 'Quantifying Oxygen Transfer: The kLa Equation and Measurement Methods',
        duration: '50 mins',
        videoUrl: 'https://www.youtube.com/embed/U33iV241kP4',
        summary: 'Derive oxygen uptake rates (OUR), oxygen transfer rates (OTR), and calculate volumetric mass transfer coefficient kLa in pilot reactors.',
        notesMarkdown: 'OTR = kLa * (C* - CL). When OTR equals OUR, dissolved oxygen CL reaches steady state.'
      }
    ],
    quiz: [
      {
        id: 'q1',
        question: 'What is the primary function of baffles inside a stirred-tank bioreactor?',
        options: ['To cool the media', 'To prevent vortex formation and promote turbulent mixing', 'To inject sterile air', 'To hold pH sensors'],
        correctAnswer: 1,
        explanation: 'Baffles break the rotational centrifugal vortex created by the impeller, converting laminar swirling into vertical axial turnover for enhanced mass transfer.'
      },
      {
        id: 'q2',
        question: 'Which chromatography resin is almost universally utilized as the initial capture step for monoclonal antibodies (mAbs)?',
        options: ['DEAE Cellulose', 'Protein A Affinity Resin', 'Octyl Sepharose', 'Sephadex G-25'],
        correctAnswer: 1,
        explanation: 'Protein A binds the Fc region of human IgG1, IgG2, and IgG4 antibodies with exceptional specificity and high binding capacity.'
      }
    ],
    featured: true
  },
  {
    id: 'course-3',
    slug: 'next-generation-sequencing-python-genomics',
    title: 'NGS Data Analysis & Python for Genomics Pipelines',
    instructor: 'Dr. Vikramaditya Joshi',
    instructorTitle: 'Bioinformatics Lead, Institute of Bioinformatics & Applied Biotech',
    level: 'Beginner',
    duration: '12 Hours (Hands-on)',
    lessonsCount: 5,
    rating: 4.9,
    studentsCount: 3410,
    category: 'Bioinformatics & NGS',
    overview: 'Learn quality control (FastQC), read alignment (BWA-MEM, STAR), variant calling (GATK HaplotypeCaller), and write Python scripts with Biopython for automating high-throughput genomic data pipelines.',
    syllabus: [
      'Module 1: The FastQ Format & Trimming with Fastp',
      'Module 2: Genome Alignment: Indexing, Burrows-Wheeler Transform, and SAM/BAM formats',
      'Module 3: GATK Best Practices for Germline & Somatic SNPs/Indels',
      'Module 4: Writing Custom Analysis Scripts in Python & BioPython',
      'Module 5: Genomic Visualization with IGV and UCSC Genome Browser'
    ],
    lessons: [
      {
        id: 'c3-l1',
        title: 'Deconstructing the FASTQ Format & Phred Quality Scores (Q30)',
        duration: '38 mins',
        videoUrl: 'https://www.youtube.com/embed/5F_P6E-o9uA',
        summary: 'Examine 4-line FASTQ structure, ASCII quality encoding (Phred+33), and calculate base-calling error probabilities.',
        notesMarkdown: 'A Phred score of Q30 indicates a 1 in 1000 probability of an incorrect base call, translating to 99.9% accuracy.'
      }
    ],
    quiz: [
      {
        id: 'q1',
        question: 'In a FASTQ record, what does a Phred quality score (Q-score) of 30 signify?',
        options: ['10% error probability', '1% error probability', '0.1% error probability (99.9% base call accuracy)', '50% probability'],
        correctAnswer: 2,
        explanation: 'Q = -10 * log10(P). For Q = 30, P = 10^(-3) = 0.001 (0.1% error rate, or 99.9% accuracy).'
      }
    ]
  }
];

export const SEED_EXAMS: Exam[] = [
  {
    id: 'exam-1',
    slug: 'csir-net-life-sciences',
    shortName: 'CSIR NET',
    fullName: 'CSIR-UGC National Eligibility Test (NET) for JRF & Lectureship - Life Sciences',
    conductingBody: 'National Testing Agency (NTA) on behalf of CSIR',
    frequency: 'Bi-annual (June & December)',
    upcomingDate: '2026-12-22',
    applicationPeriod: 'September 15 - October 25, 2026',
    eligibility: 'M.Sc or equivalent degree in Life Sciences / Biotech / Biochemistry with minimum 55% marks (General/OBC) or 50% (SC/ST/PwD). Age limit: 28 years for JRF.',
    patternOverview: 'Total 200 marks, 3 hours duration. Divided into Part A (General Aptitude - 30 marks), Part B (Core Subject MCQs - 70 marks), and Part C (Higher Order Analytical Questions - 100 marks).',
    sections: [
      { name: 'Part A (General Aptitude)', marks: 30, description: '20 questions, answer any 15 (2 marks each, -0.5 negative marking). Tests reasoning, graphical analysis, numerical ability.' },
      { name: 'Part B (Core Life Sciences)', marks: 70, description: '50 questions, answer any 35 (2 marks each, -0.5 negative marking). Tests fundamental concepts across 13 syllabus units.' },
      { name: 'Part C (Analytical & Experimental)', marks: 100, description: '75 questions, answer any 25 (4 marks each, -1.0 negative marking). In-depth scientific problems, data interpretation, hypothesis testing.' }
    ],
    keyTopics: [
      'Unit 1: Molecules & their Interaction Relevant to Biology (Biochemistry & Biophysics)',
      'Unit 2: Cellular Organization (Membrane structure, organelles, cell cycle)',
      'Unit 3: Fundamental Processes (DNA Replication, Transcription, Translation, Repair)',
      'Unit 4: Cell Communication & Cell Signaling (Host-parasite interaction, Cancer, Immunology)',
      'Unit 5: Developmental Biology (Fertilization, Cleavage, Morphogenetic gradients, Plant development)',
      'Unit 8: Inheritance Biology (Mendelian genetics, Gene mapping, Microbial genetics)',
      'Unit 13: Methods in Biology (Electrophoresis, Chromatography, NMR, Mass Spectrometry, Radiolabeling)'
    ],
    resources: [
      { id: 'r1', title: 'Official CSIR NET Life Sciences Detailed Syllabus (13 Units)', type: 'Syllabus PDF', fileSize: '1.4 MB' },
      { id: 'r2', title: 'CSIR NET Life Sciences June 2026 Solved Question Paper', year: '2026', type: 'Question Paper (PYQ)', fileSize: '4.2 MB' },
      { id: 'r3', title: 'CSIR NET Life Sciences Dec 2025 Solved Paper with Official Key', year: '2025', type: 'Question Paper (PYQ)', fileSize: '3.8 MB' },
      { id: 'r4', title: 'High-Yield Formula & Technique Quick Revision Handbook', type: 'Study Notes', fileSize: '2.9 MB' }
    ],
    mockQuestions: [
      {
        id: 'csir-m1',
        section: 'Part C (Analytical)',
        subject: 'Biochemistry / Enzyme Kinetics',
        question: 'An uncompetitive inhibitor is added to an enzymatic reaction following Michaelis-Menten kinetics. How do the apparent Km and apparent Vmax change relative to the uninhibited reaction?',
        options: [
          'Km increases and Vmax remains unchanged',
          'Both apparent Km and apparent Vmax decrease by the same factor (1 + [I]/Ki\')',
          'Km remains unchanged and Vmax decreases',
          'Km increases and Vmax decreases'
        ],
        correctIndex: 1,
        explanation: 'In uncompetitive inhibition, the inhibitor binds only to the enzyme-substrate (ES) complex. This reduces the concentration of active ES, pulling the E + S <=> ES equilibrium to the right (apparent affinity increases, so apparent Km decreases) and lowering maximum catalytic turnover (Vmax decreases by the identical factor alpha\').'
      },
      {
        id: 'csir-m2',
        section: 'Part B (Core)',
        subject: 'Molecular Biology',
        question: 'During eukaryotic pre-mRNA splicing, the branch point adenosine 2\'-OH attacks which phosphodiester bond to form the lariat intermediate?',
        options: [
          'The 3\' splice site AG dinucleotide',
          'The 5\' splice site GU dinucleotide',
          'The poly(A) cleavage signal AAUAAA',
          'The 7-methylguanosine cap bond'
        ],
        correctIndex: 1,
        explanation: 'In the first transesterification step of splicing, the nucleophilic 2\'-hydroxyl group of the conserved branch point adenosine attacks the 5\' splice site (GU), yielding a free 5\' exon and an intron-3\' exon lariat intermediate.'
      },
      {
        id: 'csir-m3',
        section: 'Part C (Analytical)',
        subject: 'Cell Signaling & Immunology',
        question: 'A chimeric antigen receptor (CAR) designed for 2nd-generation T-cell therapy incorporates which two signaling domains downstream of the scFv antigen recognition domain?',
        options: [
          'CD3-zeta chain alone',
          'CD3-zeta chain + CD28 or 4-1BB (CD137) costimulatory domain',
          'Toll-like receptor 4 (TLR4) + MyD88',
          'Fas receptor death domain + Caspase-8'
        ],
        correctIndex: 1,
        explanation: 'Second-generation CAR constructs combine primary T-cell activation signal 1 (CD3-zeta intracellular domain) with a costimulatory signal 2 domain (commonly CD28 or 4-1BB/CD137) to ensure durable T-cell proliferation and persistence without entering anergy.'
      },
      {
        id: 'csir-m4',
        section: 'Part B (Core)',
        subject: 'Plant Physiology',
        question: 'In C4 plants, the primary carboxylation reaction is catalyzed by which enzyme in the mesophyll cytoplasm?',
        options: [
          'Ribulose-1,5-bisphosphate carboxylase/oxygenase (RuBisCO)',
          'Phosphoenolpyruvate (PEP) carboxylase',
          'NADP-malic enzyme',
          'Pyruvate orthophosphate dikinase'
        ],
        correctIndex: 1,
        explanation: 'In C4 mesophyll cells, PEP carboxylase fixes atmospheric HCO3- onto PEP to generate oxaloacetate (4-carbon compound). PEP carboxylase has no oxygenase activity, preventing photorespiration.'
      },
      {
        id: 'csir-m5',
        section: 'Part C (Analytical)',
        subject: 'Methods in Biology',
        question: 'In Isoelectric Focusing (IEF), proteins migrate in an immobilized pH gradient strip until they reach a position where:',
        options: [
          'Their molecular mass exceeds the gel pore size',
          'Their net electrical charge equals zero (pH = pI)',
          'They become fully denatured by SDS',
          'All disulfide bonds are reduced by DTT'
        ],
        correctIndex: 1,
        explanation: 'In IEF, an electric field drives amphoteric molecules through a pH gradient until each protein reaches the pH value equal to its isoelectric point (pI), where its net charge is zero and electric force ceases.'
      }
    ]
  },
  {
    id: 'exam-2',
    slug: 'gate-biotechnology-bt',
    shortName: 'GATE BT',
    fullName: 'Graduate Aptitude Test in Engineering - Biotechnology (BT)',
    conductingBody: 'IIT Roorkee / IIT Council on rotational basis',
    frequency: 'Annual (February)',
    upcomingDate: '2027-02-07',
    applicationPeriod: 'August 24 - October 12, 2026',
    eligibility: 'Candidates currently studying in 3rd year or higher of undergraduate degree (B.Tech/B.Sc) or completed degree in engineering, technology, or science.',
    patternOverview: 'Total 100 marks, 65 questions, 3 hours computer-based test (CBT). General Aptitude (15 marks) + Engineering Mathematics & Subject (85 marks). Features MCQs, MSQs (Multiple Select Questions), and NATs (Numerical Answer Type).',
    sections: [
      { name: 'General Aptitude (GA)', marks: 15, description: '10 questions on verbal and numerical ability.' },
      { name: 'Biotechnology & Mathematics', marks: 85, description: '55 questions covering Bioprocess Engineering, Genetics, Microbiology, Recombinant DNA, and Engineering Math.' }
    ],
    keyTopics: [
      'Bioprocess Engineering: Material and energy balances, fluid flow, heat and mass transfer, bioreactor design, down-stream processing',
      'Molecular Biology & Genetics: Replication, transcription, translation, Mendelian genetics, recombinant DNA',
      'Biochemistry: Bioenergetics, enzyme kinetics, protein purification',
      'Engineering Mathematics: Linear algebra, calculus, differential equations, probability and statistics'
    ],
    resources: [
      { id: 'gate-r1', title: 'GATE Biotechnology (BT) Official Updated Syllabus', type: 'Syllabus PDF', fileSize: '980 KB' },
      { id: 'gate-r2', title: 'GATE BT 2026 Question Paper with Official Key', year: '2026', type: 'Question Paper (PYQ)', fileSize: '3.1 MB' }
    ],
    mockQuestions: [
      {
        id: 'gate-m1',
        section: 'Bioprocess Engineering',
        subject: 'Fermentation Kinetics',
        question: 'In a chemostat operating at steady state, what is the relation between the dilution rate (D) and the specific microbial growth rate (mu)?',
        options: ['D = mu', 'D = 2 * mu', 'mu = D / 2', 'mu = D * Ks'],
        correctIndex: 0,
        explanation: 'At steady-state in an ideal continuous stirred-tank reactor (chemostat) without cell recycle, the rate of cell generation equals cell washout, yielding Dilution Rate (D) = Specific Growth Rate (mu).'
      }
    ]
  },
  {
    id: 'exam-3',
    slug: 'dbt-bet-biotechnology-eligibility-test',
    shortName: 'DBT-BET',
    fullName: 'Biotechnology Eligibility Test (BET) for DBT-Junior Research Fellowship',
    conductingBody: 'Regional Centre for Biotechnology (RCB), Faridabad',
    frequency: 'Annual (April)',
    upcomingDate: '2027-04-20',
    applicationPeriod: 'February 10 - March 15, 2027',
    eligibility: 'M.Sc / M.Tech / M.V.Sc / Integrated M.Sc in Biotechnology and allied areas with at least 60% marks.',
    patternOverview: '300 marks total. Section A (General Biotech, Chemistry, Aptitude - 50 questions, 150 marks). Section B (Specialized Biotech areas - 50 questions out of 150, 150 marks). Category I awards national DBT-JRF; Category II awards project fellow eligibility.',
    sections: [
      { name: 'Section A (General Aptitude & Core Biotech)', marks: 150, description: '50 compulsory questions (3 marks each, -1 negative).' },
      { name: 'Section B (Specialized Biotechnology)', marks: 150, description: 'Choose any 50 questions from 150 choices spanning Agri, Medical, Environmental, and Computational biotech.' }
    ],
    keyTopics: [
      'Agricultural Biotechnology & Transgenic crops',
      'Medical & Pharmaceutical Biotechnology, Vaccines & Diagnostics',
      'Industrial Microbiology & Bioprocess',
      'Bioinformatics, Molecular Modeling, & Systems Biology'
    ],
    resources: [
      { id: 'dbt-r1', title: 'DBT-BET Syllabus & Category-I Cutoff Trends Analysis', type: 'Syllabus PDF', fileSize: '1.1 MB' },
      { id: 'dbt-r2', title: 'DBT-BET 2026 Question Paper & Official Explanations', year: '2026', type: 'Question Paper (PYQ)', fileSize: '3.5 MB' }
    ],
    mockQuestions: [
      {
        id: 'dbt-m1',
        section: 'Agricultural Biotech',
        subject: 'Plant Tissue Culture',
        question: 'In plant tissue culture, what combination of phytohormones promotes root induction (rhizogenesis) in callus tissue?',
        options: ['High Auxin to Cytokinin ratio', 'High Cytokinin to Auxin ratio', 'Equal Auxin and Gibberellic acid', 'Abscisic acid alone'],
        correctIndex: 0,
        explanation: 'As demonstrated by Skoog and Miller, a high Auxin:Cytokinin ratio induces root formation, a high Cytokinin:Auxin ratio induces shoot morphogenesis, while balanced ratios maintain undifferentiated callus growth.'
      }
    ]
  }
];

export const SEED_SCHOLARSHIPS: Scholarship[] = [
  {
    id: 'sch-1',
    slug: 'dbt-junior-research-fellowship-jrf',
    title: 'DBT-Junior Research Fellowship (DBT-JRF) Category-I',
    provider: 'Department of Biotechnology, Ministry of Science & Technology, Govt. of India',
    amount: '₹37,000 / month + HRA (JRF) -> ₹42,000 / month (SRF)',
    coverage: 'Monthly stipend + ₹30,000 annual institutional contingency grant for 5 years.',
    deadline: '2027-03-31',
    scope: 'National (India)',
    level: 'Ph.D / Fellowship',
    eligibility: [
      'Must qualify DBT-BET examination with Category-I rank (top ~275 candidates)',
      'M.Sc / M.Tech in Biotechnology, Bioinformatics, Life Sciences with minimum 60% marks',
      'Upper age limit: 28 years (relaxable up to 5 years for SC/ST/differently abled/women)'
    ],
    benefits: [
      'Five-year guaranteed doctoral fellowship tenable at any premier Indian university or national institute (IISc, IITs, IISERs, CSIR labs)',
      'Subsidized international conference travel grant through DBT-CTEP',
      'Contingency grant for consumables, laptop purchase, and academic book allowance'
    ],
    documentsRequired: [
      'DBT-BET Category-I Award Letter',
      'M.Sc Final Degree / Provisional Certificate',
      'Ph.D Admission Confirmation / Registration letter from Host Institution',
      'Host Institution Joining Report signed by Head of Department'
    ],
    applicationUrl: 'https://rcb.res.in/dbtjrf',
    featured: true
  },
  {
    id: 'sch-2',
    slug: 'dst-inspire-fellowship-for-doctoral-research',
    title: 'DST-INSPIRE Fellowship for Doctoral Research in Life Sciences',
    provider: 'Department of Science and Technology (DST), Govt. of India',
    amount: '₹37,000 / month + HRA + ₹20,000 annual contingency',
    coverage: 'Full 5-year Ph.D fellowship without requiring NET/GATE for University 1st Rank Holders.',
    deadline: '2026-12-15',
    scope: 'National (India)',
    level: 'Ph.D / Fellowship',
    eligibility: [
      'University 1st Rank Holder in M.Sc / Integrated M.Sc examination at Post-Graduate level in any basic or applied science',
      'OR INSPIRE Scholars who have secured minimum 70% marks in aggregate at M.Sc level',
      'Admitted or enrolled in Ph.D program at a recognized Indian University / Research Institute'
    ],
    benefits: [
      'Financial parity with national CSIR/UGC fellowship norms',
      'Direct selection based on academic excellence and Ph.D research proposal review by DST expert committee'
    ],
    documentsRequired: [
      'University 1st Rank Certificate issued by Controller of Examinations',
      'Brief Ph.D Research Proposal (max 1000 words)',
      'Curriculum Vitae of Ph.D Research Supervisor'
    ],
    applicationUrl: 'https://online-inspire.gov.in',
    featured: true
  },
  {
    id: 'sch-3',
    slug: 'pmrf-prime-ministers-research-fellowship',
    title: 'Prime Minister’s Research Fellowship (PMRF)',
    provider: 'Ministry of Education, Govt. of India',
    amount: '₹70,000 - ₹80,000 / month + ₹2,00,000 annual research grant',
    coverage: 'Highest-paying doctoral fellowship in India for frontier STEM & Biotechnology research.',
    deadline: '2027-01-15',
    scope: 'National (India)',
    level: 'Ph.D / Fellowship',
    eligibility: [
      'Completed or in final year of B.Tech / M.Sc from PMRF-granting institutions (IITs, IISc, IISERs, Central Universities)',
      'Minimum CGPA 8.0 on a 10-point scale or GATE score >= 650',
      'Rigorous research proposal evaluated by the National Steering Committee'
    ],
    benefits: [
      '₹70,000/mo (Years 1-2), ₹75,000/mo (Year 3), ₹80,000/mo (Years 4-5)',
      '₹2 Lakhs per annum contingency grant for international conference presentations, high-performance computing, and specialized reagents'
    ],
    documentsRequired: ['Project Abstract & Literature Review', 'Statement of Purpose', 'Two Recommendation Letters'],
    applicationUrl: 'https://pmrf.in',
    featured: true
  },
  {
    id: 'sch-4',
    slug: 'fulbright-nehru-masters-fellowship-usa',
    title: 'Fulbright-Nehru Master’s Fellowships in Public Health & Biotechnology',
    provider: 'United States-India Educational Foundation (USIEF)',
    amount: 'Full Tuition + Monthly Living Stipend + J-1 Visa Support + Airfare',
    coverage: '1 to 2 years Master’s Degree at accredited US Universities.',
    deadline: '2027-05-15',
    scope: 'International (USA/EU)',
    level: 'M.Sc',
    eligibility: [
      'Four-year Bachelor’s degree in Biotechnology / Health Sciences / Pharmacy from a recognized Indian university',
      'Minimum 55% marks in aggregate',
      'At least 3 years of substantial full-time professional work experience'
    ],
    benefits: [
      'Complete tuition coverage at premier US universities (e.g. Johns Hopkins, MIT, Harvard)',
      'Health accident insurance and dedicated US educational advisor'
    ],
    documentsRequired: ['Three letters of reference', 'Transcripts and degree certificates', 'Study/Research Objectives essay'],
    applicationUrl: 'https://usief.org.in',
    featured: false
  }
];

export const SEED_RESEARCH: ResearchPaper[] = [
  {
    id: 'paper-1',
    doi: '10.1038/s41587-026-02148-3',
    pubmedId: '38891240',
    title: 'Engineered Compact Cas12m Endonucleases for Efficient In Vivo Delivery and Target Deletion in Human Hepatocytes',
    authors: ['Sharma, P.', 'Mukherjee, R.', 'Venkatesh, K.', 'Narasimhan, S.'],
    journal: 'Nature Biotechnology',
    publishedDate: '2026-09-14',
    category: 'Gene Editing (CRISPR)',
    abstract: 'CRISPR-Cas genome editing holds transformative promise for monogenic disorders. However, the packaging limit of adeno-associated virus (AAV) vectors (~4.7 kb) restricts the co-delivery of conventional Cas9 with donor templates. Here, we characterize Cas12m, an ultra-compact 780-amino-acid endonuclease derived from uncultivated archaea. In human embryonic kidney cells and primary hepatocytes, Cas12m delivers >68% editing efficiency with negligible off-target cleavage at predicted genomic loci.',
    keywords: ['CRISPR', 'Cas12m', 'AAV Vector', 'Hepatocytes', 'Gene Therapy'],
    citationCount: 42,
    openAccess: true,
    externalUrl: 'https://doi.org/10.1038/s41587-026-02148-3'
  },
  {
    id: 'paper-2',
    doi: '10.1016/j.cell.2026.07.019',
    pubmedId: '38972105',
    title: 'Self-Amplifying mRNA Vaccine Formulations Induce Prolonged Humoral and T-Cell Memory Against Pan-Betacoronaviruses',
    authors: ['Choudhury, A.', 'Banerjee, D.', 'Deshmukh, M.', 'Patel, K.'],
    journal: 'Cell',
    publishedDate: '2026-08-02',
    category: 'mRNA Vaccines',
    abstract: 'Self-amplifying RNA (saRNA) platforms encode the viral replicase machinery from alphaviruses, allowing a 10- to 50-fold reduction in clinical dose compared to conventional modified mRNA vaccines. We synthesized ionizable lipid nanoparticles encapsulating Venezuelan Equine Encephalitis virus-derived saRNA encoding a mosaic receptor-binding domain. Non-human primate cohorts showed robust neutralizing antibody titers sustained beyond 360 days.',
    keywords: ['saRNA', 'Lipid Nanoparticles', 'Vaccine Immunology', 'Memory T Cells'],
    citationCount: 89,
    openAccess: true,
    externalUrl: 'https://doi.org/10.1016/j.cell.2026.07.019'
  },
  {
    id: 'paper-3',
    doi: '10.1126/science.ade4821',
    pubmedId: '38654129',
    title: 'CRISPR-Edited Climate-Resilient C4 Rice Displays Enhanced Water-Use Efficiency via Stomatal Conductance Tuning',
    authors: ['Swaminathan, G.', 'Reddy, B. V.', 'Kaur, H.', 'Singh, R. P.'],
    journal: 'Science',
    publishedDate: '2026-06-18',
    category: 'Plant Biotechnology',
    abstract: 'Global agricultural security under climate change requires crops with reduced transpiration without sacrificing photosynthetic biomass. By knocking out a negative transcriptional regulator of epidermal patterning factor 1 (EPF1), we achieved a 22% reduction in stomatal density in indica rice (Oryza sativa). Field trials demonstrated 34% water savings during drought spells while maintaining grain yield parity.',
    keywords: ['Oryza sativa', 'EPF1', 'Drought Resistance', 'Stomata', 'Food Security'],
    citationCount: 114,
    openAccess: false,
    externalUrl: 'https://doi.org/10.1126/science.ade4821'
  },
  {
    id: 'paper-4',
    doi: '10.1038/s41586-026-07112-w',
    pubmedId: '39011488',
    title: 'De Novo Protein Design of High-Affinity Binders Targeting Undruggable Oncogenic KRAS Mutations',
    authors: ['Menon, T.', 'Baker, D. Collab.', 'Iyer, S.'],
    journal: 'Nature',
    publishedDate: '2026-10-08',
    category: 'Synthetic Biology',
    abstract: 'Targeting mutated KRAS variants (G12D, G12V) has challenged small-molecule medicinal chemistry due to shallow pocket topography. Using deep-learning diffusion models (RFdiffusion) and molecular dynamics simulations, we generated sub-nanomolar macrocyclic miniproteins that physically occlude the effector-binding switch I/II regions, terminating downstream MAPK signaling in xenograft tumor models.',
    keywords: ['Protein Design', 'RFdiffusion', 'KRAS G12D', 'Macromolecular Therapeutics'],
    citationCount: 29,
    openAccess: true,
    externalUrl: 'https://doi.org/10.1038/s41586-026-07112-w'
  }
];

export const SEED_DISCUSSIONS: DiscussionTopic[] = [
  {
    id: 'disc-1',
    title: 'Troubleshooting low protein yield during Ni-NTA affinity chromatography (inclusion bodies)',
    authorName: 'Priya Sundaram',
    authorRole: 'Ph.D Scholar, IISc Bengaluru',
    category: 'Wet Lab Protocols',
    content: 'My 45 kDa recombinant His-tagged protein is expressed in E. coli BL21(DE3) after 0.5 mM IPTG induction at 37°C. When I lyse cells and run SDS-PAGE, 90% of my target band is sequestered in the pellet fraction (inclusion bodies). Has anyone successfully solubilized without losing enzymatic activity, or should I switch induction to 16°C overnight?',
    createdAt: '2026-11-01',
    upvotes: 24,
    replies: [
      {
        id: 'rep-1',
        authorName: 'Dr. Sameer Quadri',
        authorRole: 'Postdoc, NCBS',
        content: 'Drop your induction temperature to 18°C or 16°C immediately after reaching OD600 ~0.6, and reduce IPTG to 0.1 mM. Slowing translation allows chaperones (DnaK/GroEL) to fold the nascent peptide. Also consider adding 1% glucose to LB to repress leaky T7 expression.',
        createdAt: '2026-11-01',
        upvotes: 18
      },
      {
        id: 'rep-2',
        authorName: 'Kavita Menon',
        authorRole: 'QC Scientist, Syngene',
        content: 'If low temp doesn\'t work, solubilize pellet in 6M Urea or 6M Guanidine-HCl, bind to Ni-NTA under denaturing conditions, and perform an on-column refolding gradient down to 0M Urea with 5mM reduced glutathione (GSH) and 0.5mM oxidized glutathione (GSSG).',
        createdAt: '2026-11-02',
        upvotes: 11
      }
    ]
  },
  {
    id: 'disc-2',
    title: 'Choosing between CSIR NET JRF vs GATE BT for industrial Biopharma R&D careers',
    authorName: 'Rohit Verma',
    authorRole: 'M.Sc Biotech 2nd Year, Pune University',
    category: 'Career Decisions',
    content: 'I want to eventually work in Upstream/Downstream process development at companies like Biocon or Serum Institute. Should I dedicate my preparation to CSIR NET Life Sciences or GATE Biotechnology?',
    createdAt: '2026-10-29',
    upvotes: 31,
    replies: [
      {
        id: 'rep-3',
        authorName: 'Aditi Chawla',
        authorRole: 'Process Engineer, Dr. Reddy\'s',
        content: 'For biopharma industry jobs, GATE Biotechnology is far more aligned because it emphasizes bioprocess calculations, mass transfer, material balances, and bioreactor kinetics. Companies actively screen for candidates who understand engineering principles.',
        createdAt: '2026-10-30',
        upvotes: 27
      }
    ]
  }
];

export const SEED_MENTORS: Mentor[] = [
  {
    id: 'men-1',
    name: 'Dr. Nalini Parthasarathy',
    designation: 'Principal Scientist & Tech Transfer Lead',
    organization: 'Biocon Biologics',
    specialty: ['Monoclonal Antibodies', 'Upstream Fermentation', 'ICH Quality Guidelines', 'Pharma CV Review'],
    experience: '14+ years in biomanufacturing',
    availableSlots: 'Next slot: Saturday 4:00 PM IST',
    bio: 'Mentored 120+ biotech freshers transitioning from M.Sc/B.Tech into industry roles. Passionate about scientific rigor and real-world bioprocess operations.'
  },
  {
    id: 'men-2',
    name: 'Dr. Tariq Al-Hassan',
    designation: 'Bioinformatics Scientist & Single-Cell Lead',
    organization: 'European Bioinformatics Institute (EMBL-EBI)',
    specialty: ['RNA-Seq Pipelines', 'Nextflow', 'Postdoc Applications in Europe', 'Computational Biology'],
    experience: '9 years computational genomics',
    availableSlots: 'Next slot: Sunday 6:30 PM IST',
    bio: 'Assists researchers in building competitive coding portfolios, mastering biostatistics, and crafting compelling SOPs for international PhD programs.'
  },
  {
    id: 'men-3',
    name: 'Dr. Shalini Deshpande',
    designation: 'Associate Professor & DST-SwarnaJayanti Fellow',
    organization: 'IIT Delhi - Department of Biochemical Engineering',
    specialty: ['CSIR NET Strategy', 'Academic Grants', 'CRISPR Plant Biology', 'Ph.D Defense Prep'],
    experience: '12 years academic leadership',
    availableSlots: 'Next slot: Tuesday 5:00 PM IST',
    bio: 'Guided 8 doctoral scholars to faculty positions and premier postdoc fellowships. Offers personalized mentorship on scientific hypotheses and viva preparation.'
  }
];

export const SEED_NEWS: NewsArticle[] = [
  {
    id: 'news-1',
    slug: 'india-approves-first-indigenous-mrna-cancer-vaccine-trials',
    title: 'DCGI Grants Phase 1/2 Clinical Trial Approval for India’s First Indigenous mRNA Therapeutic Cancer Vaccine',
    sourceName: 'Department of Biotechnology Press Bureau',
    sourceUrl: 'https://dbtindia.gov.in',
    category: 'Biopharma',
    publishedDate: '2026-11-02',
    readTime: '4 min read',
    summary: 'The Drugs Controller General of India (DCGI) has greenlit human clinical trials for a personalized neoantigen mRNA vaccine platform developed jointly by Gennova Biopharmaceuticals and CSIR-CDRI.',
    content: 'In a milestone for Indian biotechnology, regulatory clearance was granted following extensive preclinical validation in rodent and non-human primate melanoma models. The platform leverages novel lipid nanoparticles formulated with local non-infringing lipids, ensuring cost-effective cold-chain stability at standard 2°C to 8°C refrigeration temperatures.'
  },
  {
    id: 'news-2',
    slug: 'icrisat-deploys-crispr-pearl-millet-combating-heat-stress',
    title: 'ICRISAT Hyderabad Deploys CRISPR-Edited Pearl Millet Adapted to Severe Semi-Arid Heatwaves',
    sourceName: 'ICRISAT International Science Dispatch',
    sourceUrl: 'https://icrisat.org',
    category: 'Agri-Biotech',
    publishedDate: '2026-10-31',
    readTime: '3 min read',
    summary: 'Agricultural scientists have engineered climate-resilient millet varieties demonstrating 28% higher grain filling during 44°C ambient flowering temperatures in peninsular India.',
    content: 'By targeting heat-shock transcription factor regulators (HsfA2), the research team achieved prolonged photosynthetic stability during peak midday solar irradiance. Field trials in Rajasthan and Telangana show exceptional promise for dryland smallholder farmers facing volatile monsoon shifts.'
  },
  {
    id: 'news-3',
    slug: 'who-endorses-serum-institute-quadrivalent-malaria-candidate',
    title: 'WHO Prequalification Committee Commends Phase 3 Results of Serum Institute’s Next-Gen Malaria Candidate',
    sourceName: 'World Health Organization Geneva',
    sourceUrl: 'https://who.int',
    category: 'Clinical Trials',
    publishedDate: '2026-10-27',
    readTime: '5 min read',
    summary: 'Serum Institute of India announced conclusive multinational Phase 3 data showing 79% protective efficacy against clinical Plasmodium falciparum malaria in infants over a 24-month monitoring window.',
    content: 'The quadrivalent candidate utilizes a recombinant circumsporozoite protein conjugated to virus-like particles with a proprietary saponin-based adjuvant, poised to enter subsidized global supply programs across Sub-Saharan Africa by mid-2027.'
  }
];

export const SEED_SYNC_LOGS: ExternalSyncLog[] = [
  {
    id: 'sync-1',
    source: 'PubMed / NCBI E-utilities (Biotechnology Query)',
    timestamp: '2026-11-03 21:00:14 UTC',
    itemsFetched: 48,
    newItems: 6,
    status: 'Success',
    details: 'Sync completed in 1.42s. 6 new peer-reviewed articles indexed with DOI & open-access metadata.'
  },
  {
    id: 'sync-2',
    source: 'Crossref Metadata API (Life Science Journals)',
    timestamp: '2026-11-03 18:30:22 UTC',
    itemsFetched: 120,
    newItems: 14,
    status: 'Success',
    details: 'Parsed XML metadata for Nature Biotechnology, Cell, and Science. Duplicate hash validation passed.'
  },
  {
    id: 'sync-3',
    source: 'CSIR / ICMR Official Exam Feeds',
    timestamp: '2026-11-03 12:15:00 UTC',
    itemsFetched: 12,
    newItems: 1,
    status: 'Success',
    details: 'CSIR NET Life Sciences admit card alert parsed and updated.'
  }
];

export const SEED_REPORTS: ReportItem[] = [
  {
    id: 'rep-101',
    itemType: 'Job',
    itemTitle: 'Quality Control Associate - BioPharma Systems',
    reportedBy: 'user_ananya@gmail.com',
    reason: 'Expired',
    date: '2026-11-02',
    status: 'Pending'
  },
  {
    id: 'rep-102',
    itemType: 'Internship',
    itemTitle: 'Bioinformatics Remote Fellowship (Global Corp)',
    reportedBy: 'kiran_bio@iisc.ac.in',
    reason: 'Broken Link',
    date: '2026-11-01',
    status: 'Resolved'
  }
];

export const SEED_CERTIFICATE: Certificate = {
  id: 'cert-sample-1',
  certificateNumber: 'BN-2026-CRISPR-9842',
  recipientName: 'Aarav Gautam',
  courseTitle: 'CRISPR-Cas9 & Precision Gene Editing: Theory to Bench Protocol',
  issueDate: '2026-11-02',
  score: 100,
  verificationCode: 'VERIFIED-AUTHENTIC-BIO-NEXA-ACADEMY'
};
