/* ============================================================
   IUBAT SGPA Calculator
   Grading logic:
   - Theory:  Mid x25% + CT x10% + Other(direct) + Final x50%
   - Lab(1cr): Participation(direct) + Viva x20% + LabTest x20% + LabReport x50%
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'iubat-sgpa:courses:v1';
  const coursesList = document.getElementById('coursesList');
  const resSGPA = document.getElementById('resSGPA');
  const resCredits = document.getElementById('resCredits');
  const resPoints = document.getElementById('resPoints');

  let courseCount = 0;

  /* ---------- grading scale ---------- */
  const GRADE_SCALE = [
    { grade: 'A+', min: 80, point: 4.00 },
    { grade: 'A', min: 75, point: 3.75 },
    { grade: 'A-', min: 70, point: 3.50 },
    { grade: 'B+', min: 65, point: 3.25 },
    { grade: 'B', min: 60, point: 3.00 },
    { grade: 'B-', min: 55, point: 2.75 },
    { grade: 'C+', min: 50, point: 2.50 },
    { grade: 'C', min: 45, point: 2.25 },
    { grade: 'D', min: 40, point: 2.00 },
    { grade: 'F', min: 0, point: 0.00 }
  ];

  function getGradeDetails(totalMarks) {
    return GRADE_SCALE.find((g) => totalMarks >= g.min) || GRADE_SCALE[GRADE_SCALE.length - 1];
  }

  function gradeOptions(selected) {
    return GRADE_SCALE.map((g) =>
      `<option value="${g.grade}" ${g.grade === selected ? 'selected' : ''}>${g.grade} — ${g.point.toFixed(2)}</option>`
    ).join('');
  }

  function clamp(value, min, max) {
    if (Number.isNaN(value)) return min;
    return Math.min(max, Math.max(min, value));
  }

  function optionsRange(min, max, selected) {
    let out = '';
    for (let i = min; i <= max; i++) {
      out += `<option value="${i}" ${i === selected ? 'selected' : ''}>${i}</option>`;
    }
    return out;
  }

  /* ---------- course data model ---------- */
  // In-memory model kept in sync with the DOM; each course is an object
  // { id, name, type ('theory'|'lab'), credits, fields:{...} }

  function defaultCourse(overrides) {
    return Object.assign({
      id: null,
      name: '',
      type: 'theory',
      credits: 3,
      mid: '', ct: '', other: 13, final: '',
      participation: 10, viva: '', labtest: '', labreport: '',
      targetGrade: 'A-'
    }, overrides);
  }

  function courseTemplate(course) {
    const isLab = course.type === 'lab';
    return `
      <div class="course__top">
        <div class="course__name-field">
          <input type="text" class="c-name" placeholder="Course name, e.g. ENG 101"
                 value="${escapeHtml(course.name)}" aria-label="Course name">
        </div>
        <button type="button" class="course__remove" data-action="remove" title="Remove course" aria-label="Remove course">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 4h11M5.5 4V2.5h4V4M5.8 4v8M9.2 4v8M3.3 4l.6 8.5h7.2l.6-8.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <div class="course__meta">
        <div class="field">
          <label for="type-${course.id}">Course type</label>
          <select id="type-${course.id}" class="c-type" data-action="type">
            <option value="theory" ${!isLab ? 'selected' : ''}>Theory</option>
            <option value="lab" ${isLab ? 'selected' : ''}>Lab (1 credit)</option>
          </select>
        </div>
        <div class="field">
          <label for="credits-${course.id}">Credit hours</label>
          <input id="credits-${course.id}" type="number" class="c-credits" min="0.5" step="0.5"
                 value="${course.credits}" data-action="credits" ${isLab ? 'disabled' : ''}>
        </div>
        <span class="course__type-badge">${isLab ? '1-Credit Lab Course' : 'Theory Course'}</span>
      </div>

      <div class="course__marks">
        ${isLab ? labFields(course) : theoryFields(course)}
      </div>

      <div class="course__outputs">
        <div class="stat">
          <span class="stat__label">Total marks</span>
          <span class="stat__value" data-out="marks">0.00</span>
        </div>
        <div class="stat">
          <span class="stat__label">Letter grade</span>
          <span class="stat__value stat__value--grade" data-out="grade">–</span>
        </div>
        <div class="stat">
          <span class="stat__label">Grade point</span>
          <span class="stat__value" data-out="point">0.00</span>
        </div>
        <div class="stat">
          <span class="stat__label">Weighted points</span>
          <span class="stat__value" data-out="weighted">0.00</span>
        </div>
      </div>

      <div class="course__target">
        <div class="field">
          <label for="target-${course.id}">Aiming for</label>
          <select id="target-${course.id}" class="c-target" data-action="calc">
            ${gradeOptions(course.targetGrade)}
          </select>
        </div>
        <p class="course__target-hint" data-out="target-hint">—</p>
      </div>
    `;
  }

  function theoryFields(course) {
    return `
      <div class="field">
        <label for="mid-${course.id}">Mid exam</label>
        <input id="mid-${course.id}" type="number" class="c-mid" min="0" max="100" placeholder="0–100"
               value="${course.mid}" data-action="calc">
        <span class="field-hint">25% weight</span>
      </div>
      <div class="field">
        <label for="ct-${course.id}">Class test</label>
        <input id="ct-${course.id}" type="number" class="c-ct" min="0" max="100" placeholder="0–100"
               value="${course.ct}" data-action="calc">
        <span class="field-hint">10% weight</span>
      </div>
      <div class="field">
        <label for="other-${course.id}">Quiz / presentation</label>
        <select id="other-${course.id}" class="c-other" data-action="calc">
          ${optionsRange(5, 15, Number(course.other) || 13)}
        </select>
        <span class="field-hint">Counted directly</span>
      </div>
      <div class="field">
        <label for="final-${course.id}">Final exam</label>
        <input id="final-${course.id}" type="number" class="c-final" min="0" max="100" placeholder="0–100"
               value="${course.final}" data-action="calc">
        <span class="field-hint">50% weight</span>
      </div>
    `;
  }

  function labFields(course) {
    return `
      <div class="field">
        <label for="part-${course.id}">Class participation</label>
        <select id="part-${course.id}" class="c-participation" data-action="calc">
          ${optionsRange(5, 10, Number(course.participation) || 10)}
        </select>
        <span class="field-hint">Counted directly</span>
      </div>
      <div class="field">
        <label for="viva-${course.id}">Viva</label>
        <input id="viva-${course.id}" type="number" class="c-viva" min="0" max="100" placeholder="0–100"
               value="${course.viva}" data-action="calc">
        <span class="field-hint">20% weight</span>
      </div>
      <div class="field">
        <label for="labtest-${course.id}">Lab test</label>
        <input id="labtest-${course.id}" type="number" class="c-labtest" min="0" max="100" placeholder="0–100"
               value="${course.labtest}" data-action="calc">
        <span class="field-hint">20% weight</span>
      </div>
      <div class="field">
        <label for="labreport-${course.id}">Lab report</label>
        <input id="labreport-${course.id}" type="number" class="c-labreport" min="0" max="100" placeholder="0–100"
               value="${course.labreport}" data-action="calc">
        <span class="field-hint">50% weight</span>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }

  /* ---------- rendering ---------- */
  function addCourse(overrides) {
    courseCount += 1;
    const course = defaultCourse(Object.assign({ id: courseCount }, overrides));

    const li = document.createElement('li');
    li.className = 'course';
    li.id = `course-${course.id}`;
    li.dataset.id = String(course.id);
    li.innerHTML = `
      <div class="course__index">${String(course.id).padStart(2, '0')}</div>
      <div class="course__body">${courseTemplate(course)}</div>
    `;
    coursesList.appendChild(li);
    updateCourse(li);
  }

  function rebuildCourseBody(li, type) {
    const id = li.dataset.id;
    const nameInput = li.querySelector('.c-name');
    const creditsInput = li.querySelector('.c-credits');
    const targetInput = li.querySelector('.c-target');
    const course = defaultCourse({
      id,
      name: nameInput ? nameInput.value : '',
      type,
      credits: type === 'lab' ? 1 : (parseFloat(creditsInput && creditsInput.value) || 3),
      targetGrade: targetInput ? targetInput.value : 'A-'
    });
    li.querySelector('.course__body').innerHTML = courseTemplate(course);
    updateCourse(li);
  }

  /* ---------- calculation ---------- */
  function readCourse(li) {
    const type = li.querySelector('.c-type').value;
    const credits = clamp(parseFloat(li.querySelector('.c-credits').value), 0, 10);

    if (type === 'lab') {
      const participation = clamp(parseFloat(li.querySelector('.c-participation').value), 0, 10);
      const viva = clamp(parseFloat(li.querySelector('.c-viva').value) || 0, 0, 100);
      const labtest = clamp(parseFloat(li.querySelector('.c-labtest').value) || 0, 0, 100);
      const labreport = clamp(parseFloat(li.querySelector('.c-labreport').value) || 0, 0, 100);
      const marks = participation + viva * 0.20 + labtest * 0.20 + labreport * 0.50;
      return { credits: 1, marks };
    }

    const mid = clamp(parseFloat(li.querySelector('.c-mid').value) || 0, 0, 100);
    const ct = clamp(parseFloat(li.querySelector('.c-ct').value) || 0, 0, 100);
    const other = clamp(parseFloat(li.querySelector('.c-other').value) || 0, 0, 15);
    const final = clamp(parseFloat(li.querySelector('.c-final').value) || 0, 0, 100);
    const marks = mid * 0.25 + ct * 0.10 + other + final * 0.50;
    return { credits, marks };
  }

  // What marks are still needed (in the Final Exam, or Lab Report for a
  // lab course) to reach the course's selected target grade, given the
  // other components already entered.
  function getTargetRequirement(li) {
    const type = li.querySelector('.c-type').value;
    const targetGrade = li.querySelector('.c-target').value;
    const targetInfo = GRADE_SCALE.find((g) => g.grade === targetGrade) || GRADE_SCALE[0];

    let partial, label;
    if (type === 'lab') {
      const participation = clamp(parseFloat(li.querySelector('.c-participation').value), 0, 10);
      const viva = clamp(parseFloat(li.querySelector('.c-viva').value) || 0, 0, 100);
      const labtest = clamp(parseFloat(li.querySelector('.c-labtest').value) || 0, 0, 100);
      partial = participation + viva * 0.20 + labtest * 0.20;
      label = 'Lab Report';
    } else {
      const mid = clamp(parseFloat(li.querySelector('.c-mid').value) || 0, 0, 100);
      const ct = clamp(parseFloat(li.querySelector('.c-ct').value) || 0, 0, 100);
      const other = clamp(parseFloat(li.querySelector('.c-other').value) || 0, 0, 15);
      partial = mid * 0.25 + ct * 0.10 + other;
      label = 'Final Exam';
    }

    const rawNeeded = (targetInfo.min - partial) / 0.50;
    let status = 'needed';
    if (rawNeeded <= 0) status = 'secured';
    else if (rawNeeded > 100) status = 'unreachable';

    return {
      label,
      status,
      needed: Math.max(0, rawNeeded),
      targetGrade: targetInfo.grade,
      targetPoint: targetInfo.point
    };
  }

  function updateCourse(li) {
    const { credits, marks } = readCourse(li);
    const { grade, point } = getGradeDetails(marks);
    const weighted = point * credits;

    li.querySelector('[data-out="marks"]').textContent = marks.toFixed(2);
    const gradeEl = li.querySelector('[data-out="grade"]');
    gradeEl.textContent = grade;
    gradeEl.classList.toggle('stat__value--fail', grade === 'F');
    gradeEl.classList.toggle('stat__value--grade', grade !== 'F');
    li.querySelector('[data-out="point"]').textContent = point.toFixed(2);
    li.querySelector('[data-out="weighted"]').textContent = weighted.toFixed(2);

    const hintEl = li.querySelector('[data-out="target-hint"]');
    if (hintEl) {
      const req = getTargetRequirement(li);
      hintEl.classList.toggle('is-unreachable', req.status === 'unreachable');
      if (req.status === 'secured') {
        hintEl.innerHTML = `Already on track for <strong>${req.targetGrade}</strong>`;
      } else if (req.status === 'unreachable') {
        hintEl.innerHTML = `<strong>Not achievable</strong> from here this semester`;
      } else {
        hintEl.innerHTML = `Need <strong>${req.needed.toFixed(1)}</strong> in ${req.label}`;
      }
    }

    calculateSGPA();
    persist();
  }

  function calculateSGPA() {
    let totalCredits = 0;
    let totalPoints = 0;

    coursesList.querySelectorAll('.course').forEach((li) => {
      const { credits, marks } = readCourse(li);
      const { point } = getGradeDetails(marks);
      totalCredits += credits;
      totalPoints += point * credits;
    });

    const sgpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
    resSGPA.textContent = sgpa.toFixed(2);
    resCredits.textContent = totalCredits.toFixed(totalCredits % 1 === 0 ? 0 : 1);
    resPoints.textContent = totalPoints.toFixed(2);
  }

  /* ---------- persistence ---------- */
  function persist() {
    try {
      const data = [];
      coursesList.querySelectorAll('.course').forEach((li) => {
        const type = li.querySelector('.c-type').value;
        const entry = {
          name: li.querySelector('.c-name').value,
          type,
          credits: li.querySelector('.c-credits').value,
          targetGrade: li.querySelector('.c-target').value
        };
        if (type === 'lab') {
          entry.participation = li.querySelector('.c-participation').value;
          entry.viva = li.querySelector('.c-viva').value;
          entry.labtest = li.querySelector('.c-labtest').value;
          entry.labreport = li.querySelector('.c-labreport').value;
        } else {
          entry.mid = li.querySelector('.c-mid').value;
          entry.ct = li.querySelector('.c-ct').value;
          entry.other = li.querySelector('.c-other').value;
          entry.final = li.querySelector('.c-final').value;
        }
        data.push(entry);
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* storage unavailable — fail silently, calculator still works */
    }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!Array.isArray(data) || data.length === 0) return false;
      data.forEach((entry) => addCourse(entry));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------- downloadable report images ---------- */
  function reportDateStamp() {
    return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function buildResultReport() {
    const rows = Array.from(coursesList.querySelectorAll('.course')).map((li) => {
      const name = li.querySelector('.c-name').value.trim() || 'Untitled course';
      const grade = li.querySelector('[data-out="grade"]').textContent;
      const credits = li.querySelector('.c-credits').value;
      return { name, grade, credits };
    });

    const rowsHtml = rows.length
      ? rows.map((r) => `
          <tr>
            <td>${escapeHtml(r.name)}</td>
            <td>${r.credits}</td>
            <td class="report__grade">${r.grade}</td>
          </tr>`).join('')
      : '<tr><td colspan="3">No courses added yet</td></tr>';

    document.getElementById('resultReportCapture').innerHTML = `
      <div class="report">
        <div class="report__band">
          <div class="report__brand">
            <img src="assets/logo.svg" alt="">
            <span class="report__brand-text">IUBAT SGPA</span>
          </div>
          <div class="report__meta">Result report<br>${reportDateStamp()}</div>
        </div>
        <h2 class="report__title">Semester result</h2>
        <p class="report__subtitle">Expected grade per course and overall SGPA</p>
        <table class="report__table">
          <thead><tr><th>Course</th><th>Credit</th><th>Grade</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="report__footer-band">
          <div class="report__footer-label">Expected SGPA</div>
          <div class="report__footer-value">${resSGPA.textContent}</div>
        </div>
        <p class="report__disclaimer">Total credit hours ${resCredits.textContent} · Total grade points ${resPoints.textContent} · Independent student tool, not an official IUBAT document.</p>
      </div>
    `;
  }

  function buildTargetReport() {
    const rows = Array.from(coursesList.querySelectorAll('.course')).map((li) => {
      const name = li.querySelector('.c-name').value.trim() || 'Untitled course';
      const credits = clamp(parseFloat(li.querySelector('.c-credits').value), 0, 10);
      const req = getTargetRequirement(li);
      return { name, credits, req };
    });

    let totalCredits = 0;
    let totalPoints = 0;
    rows.forEach((r) => {
      totalCredits += r.credits;
      totalPoints += r.req.targetPoint * r.credits;
    });
    const projected = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';

    const rowsHtml = rows.length
      ? rows.map((r) => {
          let needed;
          if (r.req.status === 'secured') needed = '<span class="report__status--secured">Already secured</span>';
          else if (r.req.status === 'unreachable') needed = '<span class="report__status--unreachable">Not achievable</span>';
          else needed = `${r.req.needed.toFixed(1)} in ${r.req.label}`;
          return `
            <tr>
              <td>${escapeHtml(r.name)}</td>
              <td class="report__grade">${r.req.targetGrade} — ${r.req.targetPoint.toFixed(2)}</td>
              <td>${needed}</td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="3">No courses added yet</td></tr>';

    document.getElementById('targetReportCapture').innerHTML = `
      <div class="report">
        <div class="report__band">
          <div class="report__brand">
            <img src="assets/logo.svg" alt="">
            <span class="report__brand-text">IUBAT SGPA</span>
          </div>
          <div class="report__meta">Target report<br>${reportDateStamp()}</div>
        </div>
        <h2 class="report__title">What you need in the final</h2>
        <p class="report__subtitle">Marks required per course to reach your target CGPA</p>
        <table class="report__table">
          <thead><tr><th>Course</th><th>Target (CGPA)</th><th>Expected marks needed</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="report__footer-band">
          <div class="report__footer-label">Projected SGPA at these targets</div>
          <div class="report__footer-value">${projected}</div>
        </div>
        <p class="report__disclaimer">Based on marks already entered for Mid/CT/Quiz or Participation/Viva/Lab Test · Independent student tool, not an official IUBAT document.</p>
      </div>
    `;
  }

  function downloadCapture(containerId, filename) {
    const el = document.getElementById(containerId);
    if (typeof html2canvas !== 'function') {
      alert('Could not load the image export library — check your internet connection and try again.');
      return;
    }
    html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true }).then((canvas) => {
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    });
  }

  document.getElementById('downloadResultBtn').addEventListener('click', () => {
    buildResultReport();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      downloadCapture('resultReportCapture', 'iubat-sgpa-result.jpg');
    }));
  });

  document.getElementById('downloadTargetBtn').addEventListener('click', () => {
    buildTargetReport();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      downloadCapture('targetReportCapture', 'iubat-sgpa-target.jpg');
    }));
  });

  /* ---------- events ---------- */
  coursesList.addEventListener('input', (e) => {
    const li = e.target.closest('.course');
    if (!li) return;
    if (e.target.dataset.action === 'calc' || e.target.classList.contains('c-name')) {
      updateCourse(li);
    }
    if (e.target.dataset.action === 'credits') {
      updateCourse(li);
    }
  });

  coursesList.addEventListener('change', (e) => {
    const li = e.target.closest('.course');
    if (!li) return;
    if (e.target.dataset.action === 'type') {
      rebuildCourseBody(li, e.target.value);
    } else {
      updateCourse(li);
    }
  });

  coursesList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="remove"]');
    if (!btn) return;
    const li = btn.closest('.course');
    if (li) {
      li.remove();
      calculateSGPA();
      persist();
    }
  });

  document.getElementById('addCourseBtn').addEventListener('click', () => addCourse());

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (coursesList.children.length === 0) return;
    if (confirm('Remove all courses and start over?')) {
      coursesList.innerHTML = '';
      calculateSGPA();
      persist();
    }
  });

  /* ---------- init ---------- */
  const restored = restore();
  if (!restored) {
    addCourse({ name: 'ENG 101', type: 'theory', credits: 3 });
    addCourse({ name: 'MAT 104', type: 'theory', credits: 3 });
    addCourse({ name: 'CSC 104L', type: 'lab', credits: 1 });
  }
})();
