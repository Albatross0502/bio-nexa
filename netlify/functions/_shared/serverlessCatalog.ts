/**
 * Zero-Disk-Dependency Serverless Catalog Loader for Netlify Functions.
 *
 * Uses bundled TypeScript seed definitions rather than reading local SQLite files
 * (`db/bionexa.db`) or local upload folders (`public/uploads/*`), ensuring serverless
 * functions operate reliably on read-only Netlify Lambda filesystems until Phase 04
 * Supabase persistence is provisioned.
 */

import { SEED_JOBS, SEED_INTERNSHIPS } from '../../../src/data/seedData';
import { normalizeCourseCategory, normalizeCourseStatus } from '../../../src/services/courses/courseHelpers';

export interface ServerlessJobRecord {
  id: string;
  title: string;
  employer: string;
  description: string;
  location: string;
  qualification: string;
  skills: string[];
  employmentType: string;
  salary: string;
  applicationUrl: string;
  source: string;
  originalJobUrl: string;
  publicationDate: string;
  expiryDate: string;
  lastVerificationDate: string;
  verificationStatus: string;
  verificationNotes: string;
  isActive: boolean;
  isApproved: boolean;
  featured: boolean;
  responsibilities: string[];
  requirements: string[];
  sector: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServerlessWorkshopRecord {
  id: string;
  title: string;
  name: string;
  organizer: string;
  instructor: string;
  location: string;
  venue: string;
  workMode: 'Online' | 'Offline' | 'Hybrid';
  format: 'Online' | 'Offline' | 'Hybrid';
  startDate: string;
  endDate: string;
  date: string;
  time: string;
  duration: string;
  fees: string;
  capacity: number;
  registrationUrl: string;
  registrationLink: string;
  registrationDeadline: string;
  availability: string;
  description: string;
  imageUrl: string;
  featured: boolean;
  skillsCovered: string[];
  status: 'upcoming' | 'ongoing' | 'completed';
  isApproved: boolean;
}

export interface ServerlessCourseRecord {
  id: string;
  title: string;
  name: string;
  provider: string;
  instructor: string;
  category: string;
  duration: string;
  level: string;
  deliveryMode: string;
  fees: string;
  price: string;
  eligibility: string;
  description: string;
  curriculum: string[];
  syllabus: string[];
  certificateInfo: string;
  isCertificateAvailable: boolean;
  registrationDeadline: string;
  registrationUrl: string;
  registrationLink: string;
  imageUrl: string;
  status: 'available' | 'closed';
  availability: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServerlessAnnouncementRecord {
  id: string;
  title: string;
  tag: string;
  content: string;
  date: string;
  link: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
}

export const SERVERLESS_HOMEPAGE_HIGHLIGHTS = {
  heroBadge: 'National Life Sciences Career & Research Gateway',
  bannerNotice: 'Connecting students, scholars, and biotech enterprises across India.',
  activeVacanciesCount: '23+ Active Biotech Openings',
  participatingInstitutesCount: '45+ CSIR, DBT & Biopharma Centers',
};

export const SERVERLESS_ANNOUNCEMENTS: ServerlessAnnouncementRecord[] = [
  {
    id: 'ann-1',
    title: 'IASc-INSA-NASI Summer Research Fellowships 2027 Open for Applications',
    tag: 'Fellowship',
    content: 'Indian Academy of Sciences invites applications from 1st and 2nd year Master students.',
    date: '2026-11-05',
    link: '/opportunities',
    isActive: true,
    priority: 10,
    createdAt: '2026-11-05T08:00:00.000Z',
  },
  {
    id: 'ann-2',
    title: 'CSIR NET Life Sciences 2026 Examination Bulletin Released',
    tag: 'Exam',
    content: 'National Testing Agency releases official syllabus and online test dates.',
    date: '2026-11-01',
    link: '/exams',
    isActive: true,
    priority: 8,
    createdAt: '2026-11-01T08:00:00.000Z',
  },
  {
    id: 'ann-3',
    title: 'Biocon Biologics Campus Drive: 2026 Fermentation Scientist Openings',
    tag: 'Careers',
    content: 'Direct walk-in and virtual technical interviews for Bioprocess specialists.',
    date: '2026-10-28',
    link: '/jobs/job-1',
    isActive: true,
    priority: 5,
    createdAt: '2026-10-28T08:00:00.000Z',
  },
];

export const SERVERLESS_WORKSHOPS: ServerlessWorkshopRecord[] = [
  {
    id: 'opp-work-1',
    title: 'National Hands-On Workshop on CRISPR-Cas9 & Base Editing',
    name: 'National Hands-On Workshop on CRISPR-Cas9 & Base Editing',
    organizer: 'Dr. Debojyoti Chakraborty, Senior Scientist (CSIR)',
    instructor: 'Dr. Debojyoti Chakraborty, Senior Scientist (CSIR)',
    location: 'CSIR-IGIB Wet Lab, Mathura Road, New Delhi 110025',
    venue: 'CSIR-IGIB Wet Lab, Mathura Road, New Delhi 110025',
    workMode: 'Offline',
    format: 'Offline',
    startDate: '2026-12-10',
    endDate: '2026-12-10',
    date: '2026-12-10',
    time: '09:30 AM - 05:00 PM IST',
    duration: '3 Days Intensive',
    fees: '₹1,500 (Subsidized Student Fee)',
    capacity: 40,
    registrationUrl: 'https://www.igib.res.in/',
    registrationLink: 'https://www.igib.res.in/',
    registrationDeadline: '2026-12-05',
    availability: 'Open (28/40 Seats)',
    description:
      'Comprehensive intensive workshop with theoretical lectures and wet-lab training on sgRNA design algorithms (CRISPOR, CHOPCHOP), ribonucleoprotein (RNP) electroporation, and T7E1 cleavage assay verification.',
    imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
    featured: true,
    skillsCovered: ['sgRNA Design', 'RNP Electroporation', 'Agarose Gel Electrophoresis', 'In Vitro Cleavage Assay'],
    status: 'upcoming',
    isApproved: true,
  },
  {
    id: 'opp-work-2',
    title: 'International Hands-on Bootcamp on RNA-Seq Analytics & Python for Biologists',
    name: 'International Hands-on Bootcamp on RNA-Seq Analytics & Python for Biologists',
    organizer: 'Dr. Vikram Joshi, Computational Genomics Lead',
    instructor: 'Dr. Vikram Joshi, Computational Genomics Lead',
    location: 'Live Zoom Portal & Cloud Galaxy Server (India)',
    venue: 'Live Zoom Portal & Cloud Galaxy Server (India)',
    workMode: 'Online',
    format: 'Online',
    startDate: '2026-12-18',
    endDate: '2026-12-18',
    date: '2026-12-18',
    time: '10:00 AM - 04:30 PM IST',
    duration: '2 Days Virtual',
    fees: 'Free (Sponsored by DBT Open Access Initiative)',
    capacity: 150,
    registrationUrl: 'https://www.bioinformatics.org/',
    registrationLink: 'https://www.bioinformatics.org/',
    registrationDeadline: '2026-12-14',
    availability: 'Filling Fast (8 Seats Left)',
    description:
      'Learn end-to-end RNA-Seq differential expression analysis using DESeq2 in R, write automated Python scripts with Biopython for FASTA manipulation, and generate Volcano plots and heatmaps for publication.',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    featured: true,
    skillsCovered: ['DESeq2', 'R Programming', 'Python Biopython', 'Volcano Plots', 'Pathway Enrichment (GO/KEGG)'],
    status: 'upcoming',
    isApproved: true,
  },
  {
    id: 'opp-work-3',
    title: 'Executive Workshop on HACCP Food Safety Implementation & FSSAI Lab Auditing',
    name: 'Executive Workshop on HACCP Food Safety Implementation & FSSAI Lab Auditing',
    organizer: 'Er. Rajesh Mathur, Lead FSSAI Auditor',
    instructor: 'Er. Rajesh Mathur, Lead FSSAI Auditor',
    location: 'AFSTI Lecture Hall, Malaviya Nagar Industrial Area, Jaipur',
    venue: 'AFSTI Lecture Hall, Malaviya Nagar Industrial Area, Jaipur',
    workMode: 'Offline',
    format: 'Offline',
    startDate: '2026-12-20',
    endDate: '2026-12-20',
    date: '2026-12-20',
    time: '10:00 AM - 03:00 PM IST',
    duration: '1 Day Certification',
    fees: '₹850 (Subsidized Student Rate)',
    capacity: 60,
    registrationUrl: 'https://www.afsti.org/',
    registrationLink: 'https://www.afsti.org/',
    registrationDeadline: '2026-12-15',
    availability: 'Open',
    description:
      'Intensive certification workshop covering the 7 principles of HACCP, identification of chemical, physical, and biological food hazards, risk assessment matrices, and preparation for FSSAI third-party audits.',
    imageUrl: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=800&q=80',
    featured: true,
    skillsCovered: ['HACCP Plan Formulation', 'Critical Control Points (CCPs)', 'ISO 22000', 'FSSAI Rules'],
    status: 'ongoing',
    isApproved: true,
  },
  {
    id: 'opp-work-4',
    title: 'National Workshop on High-Impact Scientific Manuscript Writing & Journal Selection',
    name: 'National Workshop on High-Impact Scientific Manuscript Writing & Journal Selection',
    organizer: 'Prof. S. Ranganathan, Chief Editor (Life Science Reviews)',
    instructor: 'Prof. S. Ranganathan, Chief Editor (Life Science Reviews)',
    location: 'DST Auditorium & Live Webcast, New Delhi',
    venue: 'DST Auditorium & Live Webcast, New Delhi',
    workMode: 'Hybrid',
    format: 'Hybrid',
    startDate: '2026-10-25',
    endDate: '2026-10-25',
    date: '2026-10-25',
    time: '02:00 PM - 06:00 PM IST',
    duration: '2 Days Masterclass',
    fees: 'Free (Registration Mandatory)',
    capacity: 200,
    registrationUrl: 'https://dst.gov.in/',
    registrationLink: 'https://dst.gov.in/',
    registrationDeadline: '2026-10-20',
    availability: 'Closed',
    description:
      'Learn structure and strategies for publishing in Nature, Cell, and PubMed-indexed life science journals. Covers effective abstract formulation, figure preparation, statistical rigor, and peer-review responses.',
    imageUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
    featured: false,
    skillsCovered: ['Manuscript Structuring', 'Scientific English', 'Journal Selection', 'Responding to Reviewers', 'Bioethics'],
    status: 'completed',
    isApproved: true,
  },
  {
    id: 'opp-work-5',
    title: 'Industrial Bioprocess Scaling & Microbial Fermentation Practicum',
    name: 'Industrial Bioprocess Scaling & Microbial Fermentation Practicum',
    organizer: 'Dr. Ramgopal Rao, Director of Academic Affairs',
    instructor: 'Dr. Ramgopal Rao, Director of Academic Affairs',
    location: 'Biocon Academy Pilot Bioreactor Facility, Electronic City Phase 1, Bengaluru 560100',
    venue: 'Biocon Academy Pilot Bioreactor Facility, Electronic City Phase 1, Bengaluru 560100',
    workMode: 'Offline',
    format: 'Offline',
    startDate: '2026-12-20',
    endDate: '2026-12-20',
    date: '2026-12-20',
    time: '09:00 AM - 05:30 PM IST',
    duration: '4 Days Pilot-Scale Lab',
    fees: '₹3,500 (Academic / Student Subsidized)',
    capacity: 25,
    registrationUrl: 'https://www.bioconacademy.com/',
    registrationLink: 'https://www.bioconacademy.com/',
    registrationDeadline: '2026-12-10',
    availability: 'Filling Fast (6 Seats Left)',
    description:
      'Hands-on training on 100L pilot bioreactors, dissolved oxygen profiling, batch fed-batch kinetics, and downstream cross-flow filtration at Biocon Academy.',
    imageUrl: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80',
    featured: true,
    skillsCovered: ['Bioreactor Setup', 'Fed-Batch Fermentation', 'Downstream Processing', 'CIP / SIP Protocols'],
    status: 'upcoming',
    isApproved: true,
  },
  {
    id: 'opp-work-6',
    title: 'Multicolor Flow Cytometry & High-Speed Cell Sorting Masterclass',
    name: 'Multicolor Flow Cytometry & High-Speed Cell Sorting Masterclass',
    organizer: 'NCBS Central Flow Cytometry Core Facility',
    instructor: 'NCBS Central Flow Cytometry Core Facility',
    location: 'National Centre for Biological Sciences (NCBS-TIFR), Bellary Road, Bengaluru 560065',
    venue: 'National Centre for Biological Sciences (NCBS-TIFR), Bellary Road, Bengaluru 560065',
    workMode: 'Hybrid',
    format: 'Hybrid',
    startDate: '2026-11-28',
    endDate: '2026-11-28',
    date: '2026-11-28',
    time: '09:30 AM - 04:30 PM IST',
    duration: '2 Days Hybrid Intensive',
    fees: '₹2,000 (Research Scholars)',
    capacity: 25,
    registrationUrl: 'https://www.ncbs.res.in/facilities/fcc',
    registrationLink: 'https://www.ncbs.res.in/facilities/fcc',
    registrationDeadline: '2026-11-22',
    availability: 'Open (18/25 Seats)',
    description:
      'Advanced fluorophore compensation, panel design for immunophenotyping, gating strategies with FlowJo, and aseptic sorting of primary T cells.',
    imageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
    featured: false,
    skillsCovered: ['Multicolor FlowJo', 'Antibody Conjugation', 'Cell Sorting', 'Gating Analysis'],
    status: 'upcoming',
    isApproved: true,
  },
];

const SERVERLESS_COURSES_RAW = [
  {
    id: 'course-1',
    name: 'CRISPR-Cas9 & Precision Gene Editing: Theory to Bench Protocol',
    provider: 'CSIR-IGIB Training Portal',
    instructor: 'Dr. Arindam Sen, Ph.D.',
    category: 'Molecular Biology',
    description:
      'Rigorous curriculum covering CRISPR-Cas9 mechanisms, sgRNA design workflows (CRISPOR, CHOPCHOP), off-target analysis, Cas variants, and mammalian editing protocols.',
    duration: '14 Hours (Self-Paced)',
    eligibility: 'B.Sc, B.Tech, M.Sc, or Ph.D students in Life Sciences',
    curriculum: [
      'Module 1: Evolution of Genomic Editing — From Zinc Fingers to Cas9/Cas12',
      'Module 2: sgRNA Design Engine & Off-Target Scoring',
      'Module 3: Delivery Systems — Electroporation, AAV & Lipid Nanoparticles',
      'Module 4: Validation Assays — T7E1, Sanger Deconvolution & NGS Amplicon-seq',
      'Module 5: Therapeutic Applications & Assay Capstone',
    ],
    deliveryMode: 'Online (Self-Paced)',
    fees: 'Free Open Curriculum',
    certificateInfo: '',
    registrationDeadline: '2026-12-31',
    registrationLink: 'https://www.igib.res.in/',
    availability: 'Available',
    status: 'available' as const,
    level: 'Intermediate',
    imageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
    featured: true,
  },
  {
    id: 'course-2',
    name: 'Industrial Bioprocess Technology: Upstream to Downstream Scale-Up',
    provider: 'Biocon Academy',
    instructor: 'Dr. Meenakshi Ramanathan',
    category: 'Biotechnology',
    description:
      'Industrial fermentation kinetics, oxygen mass transfer coefficients (kLa), fed-batch optimization, single-use bioreactors, and downstream Protein A / IEX chromatography.',
    duration: '6 Weeks (Self-Paced)',
    eligibility: 'B.E./B.Tech or M.Sc in Biotechnology, Chemical Engineering, or Microbiology',
    curriculum: [
      'Module 1: Microbial vs Mammalian Bioprocess Kinetics',
      'Module 2: Bioreactor Aeration, Agitation & kLa Determination',
      'Module 3: Continuous & Fed-Batch Feeding Strategies',
      'Module 4: Harvest, Depth Filtration & Tangential Flow Filtration',
      'Module 5: Downstream Purification & CIP/SIP Overview',
    ],
    deliveryMode: 'Hybrid',
    fees: 'Program fee applies at provider portal',
    certificateInfo: 'Program completion documentation governed by Biocon Academy enrollment terms.',
    registrationDeadline: '2026-12-20',
    registrationLink: 'https://www.bioconacademy.com/',
    availability: 'Available',
    status: 'available' as const,
    level: 'Advanced',
    imageUrl: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=800&q=80',
    featured: true,
  },
  {
    id: 'course-3',
    name: 'NGS Data Analysis & Bioinformatics Workflows',
    provider: 'Institute of Bioinformatics and Applied Biotechnology (IBAB)',
    instructor: 'Dr. Vikramaditya Joshi',
    category: 'Bioinformatics',
    description:
      'Hands-on computational pipeline covering FASTQ quality control, reference alignment (BWA-MEM, STAR), variant calling best practices, and Python/Biopython scripting.',
    duration: '4 Weeks (Self-Paced)',
    eligibility: 'Undergraduate or Postgraduate students in Biology, Bioinformatics, or CS',
    curriculum: [
      'Module 1: FASTQ Format & Phred Quality Trimming',
      'Module 2: Genome Indexing & Alignment (SAM/BAM Formats)',
      'Module 3: Germline & Somatic Variant Calling Workflows',
      'Module 4: Automation Scripting with Python & Biopython',
      'Module 5: Genome Visualization & Functional Annotation',
    ],
    deliveryMode: 'Online (Self-Paced)',
    fees: 'Check institutional course schedule',
    certificateInfo: '',
    registrationDeadline: '2026-12-31',
    registrationLink: 'https://www.ibab.ac.in/',
    availability: 'Available',
    status: 'available' as const,
    level: 'Beginner',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=80',
    featured: true,
  },
  {
    id: 'course-4',
    name: 'Applied Industrial & Environmental Microbiology',
    provider: 'NPTEL / SWAYAM',
    instructor: 'NPTEL Life Sciences Faculty',
    category: 'Microbiology',
    description:
      'Covers microbial diversity, aseptic screening, industrial strain improvement, antimicrobial susceptibility methods, and bioremediation systems.',
    duration: '8 Weeks',
    eligibility: 'B.Sc / M.Sc Microbiology, Biotechnology, and Life Sciences learners',
    curriculum: [
      'Module 1: Microbial Physiology & Growth Kinetics',
      'Module 2: Isolation, Screening & Strain Preservation',
      'Module 3: Microbial Enzymes & Metabolite Production',
      'Module 4: Quality & Sterility Testing Principles',
    ],
    deliveryMode: 'Online (Self-Paced)',
    fees: 'Free to audit (Optional exam fee per SWAYAM policy)',
    certificateInfo: 'Optional proctored exam certificate as published on SWAYAM/NPTEL.',
    registrationDeadline: '2026-12-18',
    registrationLink: 'https://onlinecourses.nptel.ac.in/',
    availability: 'Available',
    status: 'available' as const,
    level: 'Intermediate',
    imageUrl: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=800&q=80',
    featured: false,
  },
  {
    id: 'course-5',
    name: 'Human Genetics & Population Genomics Primer',
    provider: 'EMBL-EBI Open Training',
    instructor: 'EMBL-EBI Training Team',
    category: 'Genetics',
    description:
      'Explore Mendelian and complex inheritance, genome-wide association study (GWAS) concepts, variant interpretation databases, and Ensembl genome resources.',
    duration: '6 Hours (Self-Paced)',
    eligibility: 'Students & researchers in Genetics, Genomics, or Molecular Medicine',
    curriculum: [
      'Module 1: Human Genome Architecture & Variation',
      'Module 2: Interpreting Variants in Ensembl & ClinVar',
      'Module 3: Population Stratification & Linkage Disequilibrium',
      'Module 4: Responsible Genomic Data Sharing',
    ],
    deliveryMode: 'Online (Self-Paced)',
    fees: 'Free Open Access',
    certificateInfo: '',
    registrationDeadline: 'Open / Rolling',
    registrationLink: 'https://www.ebi.ac.uk/training',
    availability: 'Available',
    status: 'available' as const,
    level: 'Beginner',
    imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
    featured: false,
  },
  {
    id: 'course-6',
    name: 'Biopharmaceutical Formulation & Quality Control Fundamentals',
    provider: 'SWAYAM National Portal',
    instructor: 'Pharmaceutical Sciences Faculty',
    category: 'Pharmaceutical Sciences',
    description:
      'Foundations of drug delivery, stability indicating analytical assays (HPLC/UV), Good Manufacturing Practice (GMP) documentation, and pharmacopeial standards.',
    duration: '12 Weeks',
    eligibility: 'B.Pharm, M.Pharm, M.Sc Chemistry or Biotechnology candidates',
    curriculum: [
      'Module 1: Pre-formulation & Excipient Compatibility',
      'Module 2: Stability Testing & Shelf-Life Estimation',
      'Module 3: Analytical Method Validation (ICH Guidelines)',
      'Module 4: cGMP Batch Records & Regulatory Audits',
    ],
    deliveryMode: 'Online (Self-Paced)',
    fees: 'Free course access via SWAYAM',
    certificateInfo: 'Official SWAYAM course rules apply upon exam registration.',
    registrationDeadline: '2026-12-28',
    registrationLink: 'https://swayam.gov.in/',
    availability: 'Available',
    status: 'available' as const,
    level: 'Intermediate',
    imageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80',
    featured: false,
  },
  {
    id: 'course-7',
    name: 'Good Clinical Practice (GCP) & Clinical Trial Design Cohort',
    provider: 'NPTEL Health Sciences Track',
    instructor: 'Clinical Research Faculty',
    category: 'Clinical Research',
    description:
      'Phase I–IV clinical trial protocols, informed consent ethics, Institutional Ethics Committee (IEC) submissions, pharmacovigilance reporting, and biostatistical endpoints.',
    duration: '8 Weeks (Cohort)',
    eligibility: 'Graduates in Pharmacy, Medicine, Clinical Research, or Life Sciences',
    curriculum: [
      'Module 1: Ethics, Declaration of Helsinki & ICH-GCP',
      'Module 2: Randomized Controlled Trial Design & Blinding',
      'Module 3: Adverse Event Monitoring & Pharmacovigilance',
      'Module 4: Clinical Data Management & Case Report Forms',
    ],
    deliveryMode: 'Online (Live Cohort)',
    fees: 'Cohort Enrollment Closed for Current Cycle',
    certificateInfo: '',
    registrationDeadline: '2026-10-30',
    registrationLink: 'https://nptel.ac.in/',
    availability: 'Closed',
    status: 'closed' as const,
    level: 'Intermediate',
    imageUrl: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=800&q=80',
    featured: false,
  },
  {
    id: 'course-8',
    name: 'Essential Wet-Lab Instrumentation: PCR, Electrophoresis & Spectrophotometry',
    provider: 'NCBI & Open Science Learning Modules',
    instructor: 'Molecular Methods Curators',
    category: 'Laboratory Techniques',
    description:
      'Practical grounding in micropipetting accuracy, buffer preparation, nucleic acid quantification, primer design, end-point/qPCR troubleshooting, and SDS-PAGE.',
    duration: '3 Weeks (Self-Paced)',
    eligibility: 'B.Sc / M.Sc Life Sciences, MLT & Allied Biosciences students',
    curriculum: [
      'Module 1: Lab Math, Molarity, Serial Dilutions & Buffer Prep',
      'Module 2: UV-Vis Spectrophotometry & Nucleic Acid Purity (A260/280)',
      'Module 3: Primer Design & PCR/RT-qPCR Troubleshooting',
      'Module 4: Agarose Gel & SDS-PAGE Electrophoresis',
    ],
    deliveryMode: 'Online (Self-Paced)',
    fees: 'Free Open Resource',
    certificateInfo: '',
    registrationDeadline: 'Open / Rolling',
    registrationLink: 'https://www.ncbi.nlm.nih.gov/home/learn/',
    availability: 'Available',
    status: 'available' as const,
    level: 'Beginner',
    imageUrl: 'https://images.unsplash.com/photo-1581093588401-fbb62a02f120?auto=format&fit=crop&w=800&q=80',
    featured: false,
  },
  {
    id: 'course-9',
    name: 'Research Methodology, Experimental Design & Biostatistics',
    provider: 'NPTEL Research Methodology Program',
    instructor: 'Research Methodology Faculty',
    category: 'Research Methodology',
    description:
      'Hypothesis formulation, experimental controls, ANOVA, non-parametric tests, reproducible data reporting, literature review tools, and research ethics.',
    duration: '8 Weeks',
    eligibility: 'M.Sc, M.Tech, Ph.D scholars and early-career researchers',
    curriculum: [
      'Module 1: Formulating Research Questions & Experimental Controls',
      'Module 2: Sample Size Power Analysis & Hypothesis Testing',
      'Module 3: Reproducible Figures, Reference Managers & Preprints',
      'Module 4: Publication Ethics & Peer Review Standards',
    ],
    deliveryMode: 'Online (Self-Paced)',
    fees: 'Free to audit (Optional exam fee per NPTEL)',
    certificateInfo: 'Official NPTEL exam rules apply if registered for proctored assessment.',
    registrationDeadline: '2026-12-25',
    registrationLink: 'https://onlinecourses.nptel.ac.in/',
    availability: 'Available',
    status: 'available' as const,
    level: 'Intermediate',
    imageUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=800&q=80',
    featured: false,
  },
];

export const SERVERLESS_JOBS: ServerlessJobRecord[] = SEED_JOBS.map((j) => {
  const isApproved = j.verificationStatus === 'Verified' || j.verificationStatus === 'Link Unavailable';
  const isActive = j.verificationStatus !== 'Expired' && j.verificationStatus !== 'Rejected';
  return {
    id: j.id,
    title: j.title,
    employer: j.employer || j.company,
    description: j.description,
    location: j.location,
    qualification: j.qualification,
    skills: j.skills || [],
    employmentType: j.type || 'Full-time',
    salary: j.salary || 'Disclosed on Interview',
    applicationUrl: j.applicationUrl || j.originalJobUrl || j.source?.url || '',
    source: j.source?.name || 'Verified Source',
    originalJobUrl: j.originalJobUrl || j.applicationUrl || j.source?.url || '',
    publicationDate: j.publicationDate || j.postedDate,
    expiryDate: j.expiryDate || j.deadline,
    lastVerificationDate: j.lastVerificationDate || '',
    verificationStatus: j.verificationStatus || 'Pending Verification',
    verificationNotes: j.verificationNotes || '',
    isActive,
    isApproved,
    featured: Boolean(j.featured),
    responsibilities: j.responsibilities || [],
    requirements: j.requirements || [],
    sector: j.sector || 'Private Biopharma',
    createdAt: `${j.postedDate || '2026-11-01'}T08:00:00.000Z`,
    updatedAt: `${j.lastVerificationDate || j.postedDate || '2026-11-07'}T08:00:00.000Z`,
  };
});

export function formatServerlessJobForAdmin(j: ServerlessJobRecord) {
  return {
    id: j.id,
    title: j.title,
    company: j.employer,
    employer: j.employer,
    sector: j.sector,
    location: j.location,
    type: j.employmentType,
    salary: j.salary,
    qualification: j.qualification,
    experienceLevel: 'Experienced (3+ yrs)',
    description: j.description,
    responsibilities: j.responsibilities,
    requirements: j.requirements,
    skills: j.skills,
    deadline: j.expiryDate,
    expiryDate: j.expiryDate,
    publicationDate: j.publicationDate,
    applicationUrl: j.applicationUrl,
    originalJobUrl: j.originalJobUrl || j.applicationUrl,
    status: j.isActive ? 'Active' : 'Expired',
    featured: j.featured,
    isApproved: j.isApproved,
    isExpired: !j.isActive,
    sourceName: j.source,
    originalSource: j.source,
    verificationStatus: j.verificationStatus,
    lastVerificationDate: j.lastVerificationDate,
    verificationNotes: j.verificationNotes,
  };
}

export const SERVERLESS_COURSES: ServerlessCourseRecord[] = SERVERLESS_COURSES_RAW.map((c) => {
  const status = normalizeCourseStatus(c.status, c.availability);
  const category = normalizeCourseCategory(c.category);
  return {
    id: c.id,
    title: c.name,
    name: c.name,
    provider: c.provider,
    instructor: c.instructor,
    category,
    duration: c.duration,
    level: c.level,
    deliveryMode: c.deliveryMode,
    fees: c.fees,
    price: c.fees,
    eligibility: c.eligibility,
    description: c.description,
    curriculum: c.curriculum,
    syllabus: c.curriculum,
    certificateInfo: c.certificateInfo,
    isCertificateAvailable: Boolean(c.certificateInfo),
    registrationDeadline: c.registrationDeadline,
    registrationUrl: c.registrationLink,
    registrationLink: c.registrationLink,
    imageUrl: c.imageUrl,
    status,
    availability: status === 'closed' ? 'Closed' : 'Available',
    featured: c.featured,
    createdAt: '2026-11-01T08:00:00.000Z',
    updatedAt: '2026-11-07T08:00:00.000Z',
  };
});

export interface ServerlessInternshipRecord {
  id: string;
  slug: string;
  title: string;
  organization: string;
  location: string;
  mode: string;
  workMode: string;
  stipend: string;
  duration: string;
  deadline: string;
  category: string;
  eligibility: string;
  description: string;
  learningOutcomes: string[];
  skillsRequired: string[];
  source: { name: string; url: string; isExternal: boolean };
  sourceName: string;
  sourceUrl: string;
  applicationUrl: string;
  verificationStatus: string;
  verificationNotes: string;
  lastVerificationDate: string;
  isVerified: boolean;
  isApproved: boolean;
  isActive: boolean;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export const SERVERLESS_INTERNSHIPS: ServerlessInternshipRecord[] = SEED_INTERNSHIPS.map((i) => ({
  id: i.id,
  slug: i.slug,
  title: i.title,
  organization: i.organization,
  location: i.location,
  mode: i.mode,
  workMode: i.mode,
  stipend: i.stipend,
  duration: i.duration,
  deadline: i.deadline,
  category: i.category,
  eligibility: i.eligibility,
  description: i.description,
  learningOutcomes: i.learningOutcomes || [],
  skillsRequired: i.skillsRequired || [],
  source: i.source,
  sourceName: i.source?.name || 'Verified Partner Program',
  sourceUrl: i.source?.url || i.applicationUrl || '',
  applicationUrl: i.applicationUrl || i.source?.url || '',
  verificationStatus: 'Verified',
  verificationNotes: 'Verified host research internship program.',
  lastVerificationDate: '2026-11-07',
  isVerified: true,
  isApproved: true,
  isActive: true,
  featured: Boolean(i.featured),
  createdAt: '2026-11-01T08:00:00.000Z',
  updatedAt: '2026-11-07T08:00:00.000Z',
}));

export function formatServerlessInternshipForAdmin(i: ServerlessInternshipRecord) {
  return {
    ...i,
    status: i.verificationStatus === 'Rejected' ? 'Rejected' : !i.isActive ? 'Expired' : 'Active',
  };
}

