import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BionexaDatabase, DbWorkshop } from '../../db/bionexaDatabase';

describe('Phase 08: Workshops Management System', () => {
  const testDbDir = path.resolve(process.cwd(), 'test-data-workshops');
  const testDbPath = path.resolve(testDbDir, 'workshops-test.db');
  const testBackupDir = path.resolve(testDbDir, 'backups');
  let db: BionexaDatabase;

  before(() => {
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDbDir, { recursive: true });
    db = new BionexaDatabase(testDbPath, testBackupDir);
  });

  after(() => {
    if (fs.existsSync(testDbDir)) {
      fs.rmSync(testDbDir, { recursive: true, force: true });
    }
  });

  it('1. should create a workshop with all mandatory Phase 08 fields', () => {
    const ws = db.createWorkshop({
      id: 'ws-crispr-001',
      name: 'National Hands-On Workshop on CRISPR-Cas9 & Precision Base Editing',
      description: 'Intensive 3-day laboratory training covering sgRNA design, ribonucleoprotein (RNP) electroporation, and Sanger validation.',
      instructor: 'Dr. Debojyoti Chakraborty, Senior Principal Scientist',
      date: '2026-12-12',
      time: '09:30 AM - 05:00 PM IST',
      duration: '3 Days Intensive Wet Lab',
      format: 'Offline',
      venue: 'CSIR - Institute of Genomics & Integrative Biology, Mathura Road, New Delhi 110025',
      registrationDeadline: '2026-12-05',
      registrationLink: 'https://www.igib.res.in/training',
      availability: 'Open',
      status: 'upcoming',
      fees: '₹2,500 (Subsidized Student Rate)',
      capacity: 35,
      imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=800&q=80',
      featured: true,
      skillsCovered: ['CRISPR-Cas9', 'sgRNA Design', 'Electroporation', 'Sanger Sequencing']
    });

    assert.ok(ws);
    assert.equal(ws.id, 'ws-crispr-001');
    assert.equal(ws.name, 'National Hands-On Workshop on CRISPR-Cas9 & Precision Base Editing');
    assert.equal(ws.format, 'Offline');
    assert.equal(ws.status, 'upcoming');
    assert.equal(ws.availability, 'Open');
    assert.equal(ws.registrationDeadline, '2026-12-05');
    assert.equal(ws.registrationLink, 'https://www.igib.res.in/training');
    assert.equal(ws.featured, true);
    assert.equal(ws.capacity, 35);
    assert.equal(ws.skillsCovered.length, 4);
    assert.ok(ws.imageUrl?.includes('photo-1532187863486'));
  });

  it('2. should support online, offline, and hybrid formats', () => {
    // Online Workshop
    const onlineWs = db.createWorkshop({
      id: 'ws-rnaseq-002',
      name: 'High-Throughput RNA-Seq & Transcriptomics Analytics in R',
      description: 'Virtual computational bioinformatics bootcamp on bulk and single-cell RNA sequencing pipeline.',
      instructor: 'Prof. Utpal Nath, Department of MCB, IISc',
      date: '2026-12-18',
      time: '10:00 AM - 04:30 PM IST',
      duration: '2 Days Virtual Bootcamp',
      format: 'Online',
      venue: 'Virtual Hands-on Cloud RStudio Terminal (IISc Bioinformatics Gateway)',
      registrationDeadline: '2026-12-14',
      registrationLink: 'https://iisc.ac.in/events',
      availability: 'Filling Fast',
      status: 'upcoming',
      fees: 'Free (Sponsored Access)',
      capacity: 100,
      imageUrl: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=800&q=80',
      featured: true,
      skillsCovered: ['RNA-Seq', 'DESeq2', 'R Bioconductor', 'Pathway Enrichment']
    });

    // Hybrid Workshop
    const hybridWs = db.createWorkshop({
      id: 'ws-flow-003',
      name: 'Multicolor Flow Cytometry & Immunophenotyping Masterclass',
      description: 'Hands-on spectral flow cytometry with simultaneous online broadcast.',
      instructor: 'Central Flow Facility, NCBS Bengaluru',
      date: '2026-11-28',
      time: '09:30 AM - 04:30 PM IST',
      duration: '2 Days Hybrid',
      format: 'Hybrid',
      venue: 'NCBS-TIFR Campus, Bellary Road, Bengaluru & Online Stream',
      registrationDeadline: '2026-11-20',
      registrationLink: 'https://www.ncbs.res.in/facilities/fcc',
      availability: 'Waitlist',
      status: 'ongoing',
      fees: '₹1,800',
      capacity: 25,
      imageUrl: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=800&q=80',
      featured: false,
      skillsCovered: ['FlowJo', 'Fluorophore Compensation', 'Cell Sorting']
    });

    // Completed Workshop
    const completedWs = db.createWorkshop({
      id: 'ws-haccp-004',
      name: 'HACCP & GMP Quality Auditing for Food & Biopharma Enterprises',
      description: 'Auditing standards and FSSAI biological safety protocols.',
      instructor: 'Dr. Manish Diwan, Head - Partnerships, BIRAC',
      date: '2026-10-15',
      time: '10:00 AM - 03:00 PM IST',
      duration: '1 Day Masterclass',
      format: 'Online',
      venue: 'DBT-BIRAC Digital Portal',
      registrationDeadline: '2026-10-10',
      registrationLink: 'https://birac.nic.in/workshops',
      availability: 'Closed',
      status: 'completed',
      fees: 'Free',
      capacity: 200,
      imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
      featured: false,
      skillsCovered: ['HACCP', 'GMP Audit', 'Biosafety']
    });

    assert.equal(onlineWs.format, 'Online');
    assert.equal(hybridWs.format, 'Hybrid');
    assert.equal(completedWs.format, 'Online');
    assert.equal(completedWs.status, 'completed');
  });

  it('3. should filter workshops by status, format, and featured flag', () => {
    // Filter by format: Offline
    const offlineList = db.getWorkshops({ format: 'Offline' });
    assert.equal(offlineList.length, 1);
    assert.equal(offlineList[0].id, 'ws-crispr-001');

    // Filter by format: Online
    const onlineList = db.getWorkshops({ format: 'Online' });
    assert.equal(onlineList.length, 2);

    // Filter by status: upcoming
    const upcomingList = db.getWorkshops({ status: 'upcoming' });
    assert.equal(upcomingList.length, 2);

    // Filter by status: completed
    const completedList = db.getWorkshops({ status: 'completed' });
    assert.equal(completedList.length, 1);
    assert.equal(completedList[0].id, 'ws-haccp-004');

    // Filter by featured
    const featuredList = db.getWorkshops({ featured: true });
    assert.equal(featuredList.length, 2);

    // Filter by search keyword
    const searchList = db.getWorkshops({ search: 'CRISPR' });
    assert.equal(searchList.length, 1);
    assert.equal(searchList[0].name.includes('CRISPR'), true);
  });

  it('4. should update workshop details, registration URL, status and availability', () => {
    const updated = db.updateWorkshop('ws-rnaseq-002', {
      availability: 'Closed',
      status: 'completed',
      registrationLink: 'https://iisc.ac.in/events/archive/rnaseq-2026',
      featured: false
    });

    assert.ok(updated);
    assert.equal(updated.availability, 'Closed');
    assert.equal(updated.status, 'completed');
    assert.equal(updated.registrationLink, 'https://iisc.ac.in/events/archive/rnaseq-2026');
    assert.equal(updated.featured, false);

    // Fetch fresh from db
    const fresh = db.getWorkshopById('ws-rnaseq-002');
    assert.equal(fresh?.status, 'completed');
    assert.equal(fresh?.availability, 'Closed');
  });

  it('5. should correctly feature and unfeature workshops', () => {
    const ws = db.updateWorkshop('ws-flow-003', { featured: true });
    assert.equal(ws?.featured, true);

    const featuredList = db.getWorkshops({ featured: true });
    assert.ok(featuredList.some(w => w.id === 'ws-flow-003'));

    const unfeatured = db.updateWorkshop('ws-flow-003', { featured: false });
    assert.equal(unfeatured?.featured, false);
  });

  it('6. should delete a workshop from the database', () => {
    const deleted = db.deleteWorkshop('ws-haccp-004');
    assert.equal(deleted, true);

    const fetched = db.getWorkshopById('ws-haccp-004');
    assert.equal(fetched, null);
  });
});
