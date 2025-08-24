import { Calendar } from "@fullcalendar/core";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import { Modal } from "flowbite";

interface Period {
  startDate: string;
  endDate: string | null;
}

interface DailyNote {
  date: string;
  symptoms: string[];
  notes: string;
}

interface PillTaken {
  date: string;
  taken: boolean;
  time?: string; // Time when pill was taken (HH:mm format)
  missedReason?: string; // Reason if pill was missed
}

interface PeriodData {
  periods: Period[];
  currentPeriod: Period | null;
  notes: DailyNote[];
  pillsTaken: PillTaken[];
  settings: {
    cycleLength: number;
    periodLength: number;
    showNextPeriodPrediction: boolean;
    showOvulation: boolean;
    showSafeDays: boolean;
    pillTrackingEnabled: boolean;
    pillReminderEnabled: boolean;
    pillReminderTime: string;
    showPillsOnCalendar: boolean;
    pillPackDays: number;
  };
}

class PeriodTrackerFlowbite {
  private data: PeriodData;
  private calendar: Calendar | null = null;
  private editingPeriodIndex: number = -1;
  private resizeTimeout: any = null;
  private isMobile: boolean = false;
  private isEditMode: boolean = false;
  private modals: { [key: string]: Modal } = {};

  constructor() {
    this.data = this.loadData();
    this.updateMobileState();
    this.init();
  }

  private loadData(): PeriodData {
    const stored = localStorage.getItem("period-tracker-data");
    if (stored) {
      const parsedData = JSON.parse(stored);
      // Ensure all required properties exist with proper defaults
      return {
        periods: parsedData.periods || [],
        currentPeriod: parsedData.currentPeriod || null,
        notes: parsedData.notes || [],
        pillsTaken: parsedData.pillsTaken || [],
        settings: {
          cycleLength: parsedData.settings?.cycleLength || 28,
          periodLength: parsedData.settings?.periodLength || 5,
          showNextPeriodPrediction:
            parsedData.settings?.showNextPeriodPrediction ?? true,
          showOvulation: parsedData.settings?.showOvulation ?? true,
          showSafeDays: parsedData.settings?.showSafeDays ?? false,
          pillTrackingEnabled:
            parsedData.settings?.pillTrackingEnabled ?? false,
          pillReminderEnabled:
            parsedData.settings?.pillReminderEnabled ?? false,
          pillReminderTime: parsedData.settings?.pillReminderTime || "21:00",
          showPillsOnCalendar: parsedData.settings?.showPillsOnCalendar ?? true,
          pillPackDays: parsedData.settings?.pillPackDays || 21,
        },
      };
    }

    return {
      periods: [],
      currentPeriod: null,
      notes: [],
      pillsTaken: [],
      settings: {
        cycleLength: 28,
        periodLength: 5,
        showNextPeriodPrediction: true,
        showOvulation: true,
        showSafeDays: false,
        pillTrackingEnabled: false,
        pillReminderEnabled: false,
        pillReminderTime: "21:00",
        showPillsOnCalendar: true,
        pillPackDays: 21,
      },
    };
  }

  private saveData(): void {
    localStorage.setItem("period-tracker-data", JSON.stringify(this.data));
  }

  private updateMobileState(): void {
    this.isMobile = window.innerWidth < 768;
  }

  private getOrCreateModal(modalId: string): Modal | null {
    // Return existing modal if it exists
    if (this.modals[modalId]) {
      return this.modals[modalId];
    }

    // Create new modal instance
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
      const modal = new Modal(modalElement);
      this.modals[modalId] = modal;
      return modal;
    }

    return null;
  }

  private init(): void {
    this.initializeCalendar();
    this.updateUI();
    this.bindEvents();
  }

  private initializeCalendar(): void {
    const calendarEl = document.getElementById("calendar");
    if (!calendarEl) return;

    // Generate period and ovulation events
    const events = this.generateCalendarEvents();

    this.calendar = new Calendar(calendarEl, {
      plugins: [interactionPlugin, dayGridPlugin, timeGridPlugin, listPlugin],
      initialView: "dayGridMonth",
      headerToolbar: {
        left: "title",
        center: "",
        right: "prev,next today",
      },
      titleFormat: this.isMobile
        ? { year: "numeric", month: "short" }
        : { year: "numeric", month: "long" },
      height: "auto",
      events: events,
      selectable: true,
      editable: false,
      eventDisplay: "block",
      dayMaxEvents: true,
      dateClick: (info) => {
        this.handleDateClick(info);
      },
      eventClick: (info) => {
        this.handleEventClick(info);
      },
    });

    this.calendar.render();
  }

  private generateCalendarEvents(): any[] {
    const events: any[] = [];

    // Safety check: ensure arrays exist
    if (!this.data.periods) this.data.periods = [];
    if (!this.data.notes) this.data.notes = [];

    // Add completed periods
    this.data.periods.forEach((period, index) => {
      if (period.endDate) {
        // Add background event for visual representation
        events.push({
          id: `period-bg-${index}`,
          title: `Period Day`,
          start: period.startDate,
          end: this.addDaysToDate(period.endDate, 1), // FullCalendar end is exclusive
          className: "fc-event-period",
          display: "background",
          extendedProps: {
            type: "period-bg",
            period: period,
          },
        });

        // Add clickable event spanning the full period duration
        events.push({
          id: `period-click-${index}`,
          title: `🩸 Period (${this.calculateDuration(
            period.startDate,
            period.endDate
          )} days)`,
          start: period.startDate,
          end: this.addDaysToDate(period.endDate, 1), // Span the full period duration
          className: "fc-event-period-clickable",
          extendedProps: {
            type: "period",
            period: period,
            periodIndex: index,
          },
        });

        // Add ovulation prediction (typically 14 days before next period)
        if (this.data.settings.showOvulation) {
          const ovulationDate = this.calculateOvulationDate(period.startDate);
          if (ovulationDate) {
            events.push({
              id: `ovulation-${index}`,
              title: this.isMobile ? "Ovulation" : "🥚 Ovulation",
              start: ovulationDate,
              className: "fc-event-ovulation",
              extendedProps: {
                type: "ovulation",
              },
            });
          }
        }
      }
    });

    // Add current period
    if (this.data.currentPeriod) {
      const today = new Date().toISOString().split("T")[0];

      // Calculate expected end date for current period
      const expectedPeriodLength = this.data.settings.periodLength || 5;
      const expectedEndDate = this.addDaysToDate(
        this.data.currentPeriod.startDate,
        expectedPeriodLength - 1
      );

      // Use the later date between today and expected end date for display
      const displayEndDate = today > expectedEndDate ? today : expectedEndDate;

      // Add background event
      events.push({
        id: "current-period-bg",
        title: "Current Period",
        start: this.data.currentPeriod.startDate,
        end: this.addDaysToDate(displayEndDate, 1), // FullCalendar end is exclusive
        className: "fc-event-period",
        display: "background",
        extendedProps: {
          type: "current-period-bg",
          period: this.data.currentPeriod,
        },
      });

      // Add clickable event spanning the full period duration
      const currentDuration = this.calculateDuration(
        this.data.currentPeriod.startDate,
        today
      );
      events.push({
        id: "current-period-click",
        title: `🔴 Current Period (Day ${currentDuration})`,
        start: this.data.currentPeriod.startDate,
        end: this.addDaysToDate(displayEndDate, 1), // Same end as background event
        className: "fc-event-current-period-clickable",
        extendedProps: {
          type: "current-period",
          period: this.data.currentPeriod,
        },
      });
    }

    // Add notes
    this.data.notes.forEach((note, index) => {
      if (note.symptoms.length > 0 || note.notes) {
        // Create a more descriptive title for the note with multiline support
        let noteTitle = "";

        // Start with symptoms on the first line if they exist
        if (note.symptoms.length > 0) {
          noteTitle = `🤢 ${note.symptoms.join(", ")}`;
        }

        // Add note text on new line(s) if it exists
        if (note.notes) {
          // Don't truncate the note text, let it wrap naturally
          noteTitle = `📝 ${note.notes}`;
        }

        // Check if we're on mobile (screen width < 768px) and simplify display
        if (this.isMobile && (note.symptoms.length > 0 || note.notes)) {
          noteTitle = "📝";
        }

        events.push({
          id: `note-${index}`,
          title: noteTitle,
          start: note.date,
          className: "fc-event-note",
          backgroundColor: "#10B981", // Green background to differentiate from periods
          borderColor: "#059669",
          textColor: "#FFFFFF",
          extendedProps: {
            type: "note",
            note: note,
          },
        });
      }
    });

    // Add birth control pills
    if (
      this.data.settings.pillTrackingEnabled &&
      this.data.settings.showPillsOnCalendar &&
      this.data.pillsTaken
    ) {
      this.data.pillsTaken.forEach((pill, index) => {
        let pillTitle = "";
        let pillClass = "";
        let backgroundColor = "";
        let borderColor = "";

        if (pill.taken) {
          pillTitle = this.isMobile ? "💊" : "💊 Pill Taken";
          pillClass = "fc-event-pill-taken";
          backgroundColor = "#059669"; // Green for taken
          borderColor = "#047857";
          if (pill.time) {
            pillTitle += this.isMobile ? `(${pill.time})` : ` (${pill.time})`;
          }
        } else {
          pillTitle = this.isMobile ? "💊 ❌" : "💊 Pill Missed";
          pillClass = "fc-event-pill-missed";
          backgroundColor = "#DC2626"; // Red for missed
          borderColor = "#B91C1C";
          if (pill.missedReason) {
            pillTitle += this.isMobile ? "" : ` - ${pill.missedReason}`;
          }
        }

        events.push({
          id: `pill-${index}`,
          title: pillTitle,
          start: pill.date,
          className: pillClass,
          backgroundColor: backgroundColor,
          borderColor: borderColor,
          textColor: "#FFFFFF",
          extendedProps: {
            type: "pill",
            pill: pill,
          },
        });
      });

      // Add future pill events based on pill pack schedule
      const pillScheduleEvents = this.generatePillScheduleEvents();
      events.push(...pillScheduleEvents);
    }

    // Add next 3 period predictions
    if (
      this.data.settings.showNextPeriodPrediction &&
      this.data.periods.length >= 2
    ) {
      const futurePeriods = this.calculateFuturePeriods(10);
      futurePeriods.forEach((periodDate, index) => {
        const periodEnd = this.addDaysToDate(
          periodDate,
          this.data.settings.periodLength - 1
        );

        const periodNumber = index + 1;

        events.push({
          id: `period-prediction-${index}`,
          title: `🔮 Expected Period`,
          start: periodDate,
          end: this.addDaysToDate(periodEnd, 1), // FullCalendar end is exclusive
          className: "fc-event-period-prediction",
          display: "background",
          extendedProps: {
            type: "period-prediction",
            periodNumber: periodNumber,
          },
        });

        events.push({
          id: `period-prediction-clickable-${index}`,
          title: `🔮 Expected Period (${this.data.settings.periodLength} days)`,
          start: periodDate,
          end: this.addDaysToDate(periodEnd, 1),
          className: "fc-event-period-prediction-clickable",
          extendedProps: {
            type: "period-prediction",
            periodNumber: periodNumber,
          },
        });
      });
    }

    // Add safe days background
    if (this.data.settings.showSafeDays && this.data.periods.length >= 2) {
      const safeDayRanges = this.calculateSafeDays();
      safeDayRanges.forEach((range, index) => {
        events.push({
          id: `safe-days-${index}`,
          title: "Safe Days",
          start: range.start,
          end: this.addDaysToDate(range.end, 1), // FullCalendar end is exclusive
          className: "fc-event-safe-days",
          display: "background",
          extendedProps: {
            type: "safe-days",
          },
        });
      });
    }

    return events;
  }

  private calculateOvulationDate(periodStart: string): string | null {
    // Assume average cycle length of 28 days, ovulation 14 days before next period
    const avgCycleLength = this.getAverageCycleLength() || 28;
    const ovulationDay = avgCycleLength - 14;

    if (ovulationDay > 0) {
      return this.addDaysToDate(periodStart, ovulationDay);
    }
    return null;
  }

  private calculateNextPeriodDate(): string | null {
    if (this.data.periods.length < 2) return null;

    // Use the last period as reference
    const lastPeriod = this.data.periods[this.data.periods.length - 1];
    if (!lastPeriod.endDate) return null;

    const avgCycleLength = this.getAverageCycleLength() || 28;
    return this.addDaysToDate(lastPeriod.startDate, avgCycleLength);
  }

  private calculateFuturePeriods(count: number): string[] {
    if (this.data.periods.length < 2) return [];

    const futurePeriods: string[] = [];
    const lastPeriod = this.data.periods[this.data.periods.length - 1];
    if (!lastPeriod.endDate) return [];

    const avgCycleLength = this.getAverageCycleLength() || 28;
    let currentPredictionDate = lastPeriod.startDate;

    for (let i = 0; i < count; i++) {
      currentPredictionDate = this.addDaysToDate(
        currentPredictionDate,
        avgCycleLength
      );
      futurePeriods.push(currentPredictionDate);
    }

    return futurePeriods;
  }

  private calculateSafeDays(): { start: string; end: string }[] {
    if (this.data.periods.length < 2) return [];

    const safeDayRanges: { start: string; end: string }[] = [];
    const avgCycleLength = this.getAverageCycleLength() || 28;
    const today = new Date();
    const oneMonthFromNow = new Date(today);
    oneMonthFromNow.setMonth(today.getMonth() + 1);

    // Calculate safe days for the next month
    const nextPeriodDate = this.calculateNextPeriodDate();
    if (!nextPeriodDate) return [];

    const nextPeriodStart = new Date(nextPeriodDate);
    const currentDate = new Date();

    // Fertile window: 5 days before ovulation + ovulation day + 1 day after
    const ovulationDate = new Date(nextPeriodStart);
    ovulationDate.setDate(nextPeriodStart.getDate() - 14);

    const fertileWindowStart = new Date(ovulationDate);
    fertileWindowStart.setDate(ovulationDate.getDate() - 5);

    const fertileWindowEnd = new Date(ovulationDate);
    fertileWindowEnd.setDate(ovulationDate.getDate() + 1);

    const expectedPeriodEnd = new Date(nextPeriodStart);
    expectedPeriodEnd.setDate(
      nextPeriodStart.getDate() + this.data.settings.periodLength - 1
    );

    // Safe days before fertile window (after period ends until fertile window starts)
    const lastPeriod = this.data.periods[this.data.periods.length - 1];
    if (lastPeriod.endDate) {
      const lastPeriodEnd = new Date(lastPeriod.endDate);
      lastPeriodEnd.setDate(lastPeriodEnd.getDate() + 1); // Day after period ends

      if (lastPeriodEnd < fertileWindowStart) {
        safeDayRanges.push({
          start: lastPeriodEnd.toISOString().split("T")[0],
          end: this.addDaysToDate(
            fertileWindowStart.toISOString().split("T")[0],
            -1
          ),
        });
      }
    }

    // Safe days after fertile window (after fertile window until next period)
    const dayAfterFertileWindow = new Date(fertileWindowEnd);
    dayAfterFertileWindow.setDate(fertileWindowEnd.getDate() + 1);

    if (dayAfterFertileWindow < nextPeriodStart) {
      safeDayRanges.push({
        start: dayAfterFertileWindow.toISOString().split("T")[0],
        end: this.addDaysToDate(
          nextPeriodStart.toISOString().split("T")[0],
          -1
        ),
      });
    }

    return safeDayRanges;
  }

  private addDaysToDate(dateString: string, days: number): string {
    const date = new Date(dateString);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }

  private calculateDuration(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  }

  private generatePillScheduleEvents(): any[] {
    const events: any[] = [];

    if (
      !this.data.settings.pillTrackingEnabled ||
      !this.data.settings.showPillsOnCalendar
    ) {
      return events;
    }

    // Find the very first pill date to establish the pack cycle start
    let firstPillDate: string | null = null;
    if (this.data.pillsTaken.length > 0) {
      // Sort pills by date and get the earliest one
      const sortedPills = [...this.data.pillsTaken].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      firstPillDate = sortedPills[0].date;
    }

    // If no pills recorded, don't generate events
    if (!firstPillDate) {
      return events;
    }

    // Generate pill events for the entire period after the first pill
    const packDays = this.data.settings.pillPackDays;
    const breakDays = 7; // Standard 7-day break
    const fullCycleDays = packDays + breakDays;
    const today = new Date().toISOString().split("T")[0];

    // Start from the day after the first pill
    const startDate = new Date(firstPillDate);
    startDate.setDate(startDate.getDate() + 1);

    // Generate events up to 90 days from today (covers past missed days and future cycles)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0];

      // Don't show events for dates that already have pills recorded
      const existingPill = this.data.pillsTaken.find(
        (pill) => pill.date === dateStr
      );
      if (existingPill) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }

      // Calculate which day of the pack cycle this would be based on the first pill
      const daysSinceFirstPill = Math.floor(
        (new Date(dateStr).getTime() - new Date(firstPillDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Calculate position within the current cycle
      const dayInCycle = (daysSinceFirstPill % fullCycleDays) + 1;

      // Only show events for active pill days (not during the break week)
      // Days 1-21 (or whatever packDays is set to) are active pill days
      if (dayInCycle <= packDays) {
        const packDay = dayInCycle;
        const isPastEvent = dateStr < today;

        events.push({
          id: `pill-schedule-${dateStr}`,
          title: this.isMobile
            ? isPastEvent
              ? "💊 ⏰"
              : "💊 📅"
            : `💊 ${isPastEvent ? "Scheduled" : "Take"} Pill (Day ${packDay})`,
          start: dateStr,
          className: isPastEvent
            ? "fc-event-pill-past"
            : "fc-event-pill-future",
          backgroundColor: isPastEvent ? "#F59E0B" : "#6366F1", // Amber for past, Indigo for future
          borderColor: isPastEvent ? "#D97706" : "#4F46E5",
          textColor: "#FFFFFF",
          extendedProps: {
            type: isPastEvent ? "pill-past" : "pill-future",
            date: dateStr,
            packDay: packDay,
          },
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return events;
  }

  private handleDateClick(info: any): void {
    const today = new Date().toISOString().split("T")[0];

    // If clicking on today and pill tracking is enabled, show quick actions
    if (info.dateStr === today && this.data.settings.pillTrackingEnabled) {
      const existingPill = this.data.pillsTaken.find(
        (pill) => pill.date === today
      );

      // If no pill recorded for today, show quick pill modal
      if (!existingPill) {
        if (confirm("Would you like to record your pill for today?")) {
          this.openPillModal();
          return;
        }
      }
    }

    // Open note modal for the clicked date
    const noteDateInput = document.getElementById(
      "note-date"
    ) as HTMLInputElement;

    if (noteDateInput) {
      noteDateInput.value = info.dateStr;
    }

    // Load existing note if available
    const existingNote = this.data.notes.find(
      (note) => note.date === info.dateStr
    );
    if (existingNote) {
      this.populateNoteModal(existingNote);
    } else {
      this.clearNoteModal();
    }

    // Show modal using Flowbite
    const modal = this.getOrCreateModal("note-modal");
    if (modal) {
      modal.show();
    }
  }

  private handleEventClick(info: any): void {
    const eventType = info.event.extendedProps.type;

    if (eventType === "note") {
      const note = info.event.extendedProps.note;
      this.populateNoteModal(note);

      const modal = this.getOrCreateModal("note-modal");
      if (modal) {
        modal.show();
      }
    } else if (eventType === "period" || eventType === "current-period") {
      const period = info.event.extendedProps.period;
      const periodIndex = info.event.extendedProps.periodIndex;
      this.openPeriodModal(
        "edit",
        period,
        eventType === "current-period",
        periodIndex
      );
    } else if (eventType === "pill") {
      const pill = info.event.extendedProps.pill;
      this.openPillModal(pill);
    } else if (eventType === "pill-future" || eventType === "pill-past") {
      // Handle future or past pill events - open pill modal for that date
      const eventDate = info.event.extendedProps.date;
      // Create a temporary pill object with the event date
      const tempPill: PillTaken = {
        date: eventDate,
        taken: false,
        time: this.data.settings.pillReminderTime,
      };
      this.openPillModal(tempPill);
    }
  }

  private populateNoteModal(note: DailyNote): void {
    const noteDateInput = document.getElementById(
      "note-date"
    ) as HTMLInputElement;
    const noteTextArea = document.getElementById(
      "note-text"
    ) as HTMLTextAreaElement;
    const deleteBtn = document.getElementById(
      "delete-note-btn"
    ) as HTMLButtonElement;

    if (noteDateInput) noteDateInput.value = note.date;
    if (noteTextArea) noteTextArea.value = note.notes;

    // Show delete button for existing notes
    if (deleteBtn) deleteBtn.style.display = "inline-flex";

    // Select symptoms
    document.querySelectorAll(".symptom-tag").forEach((tag) => {
      const symptom = tag.getAttribute("data-symptom");
      if (symptom && note.symptoms.includes(symptom)) {
        tag.classList.add("selected");
      } else {
        tag.classList.remove("selected");
      }
    });
  }

  private clearNoteModal(): void {
    const noteTextArea = document.getElementById(
      "note-text"
    ) as HTMLTextAreaElement;
    const deleteBtn = document.getElementById(
      "delete-note-btn"
    ) as HTMLButtonElement;

    if (noteTextArea) noteTextArea.value = "";

    // Hide delete button for new notes
    if (deleteBtn) deleteBtn.style.display = "none";

    document.querySelectorAll(".symptom-tag").forEach((tag) => {
      tag.classList.remove("selected");
    });
  }

  private bindEvents(): void {
    // Period tracking buttons
    document
      .getElementById("start-period-btn")
      ?.addEventListener("click", (event) => {
        const button = event.target as HTMLButtonElement;
        if (button.disabled) {
          // Provide feedback that period is already ongoing
          alert(
            "You already have an ongoing period. End the current period first to start a new one."
          );
          return;
        }
        this.openPeriodModal("start");
      });

    // Add Period button (in calendar section)
    document.getElementById("add-period-btn")?.addEventListener("click", () => {
      this.openPeriodModal("add");
    });

    // Update button event listeners for unified modal
    document
      .getElementById("period-primary-btn")
      ?.addEventListener("click", () => {
        this.handlePeriodSubmit();
      });

    document.getElementById("end-period-btn")?.addEventListener("click", () => {
      this.endPeriod();
    });

    // Note modal events
    document.getElementById("add-note-btn")?.addEventListener("click", () => {
      const today = new Date().toISOString().split("T")[0];
      const noteDateInput = document.getElementById(
        "note-date"
      ) as HTMLInputElement;
      if (noteDateInput) noteDateInput.value = today;

      const existingNote = this.data.notes.find((note) => note.date === today);
      if (existingNote) {
        this.populateNoteModal(existingNote);
      } else {
        this.clearNoteModal();
      }

      const modal = this.getOrCreateModal("note-modal");
      if (modal) {
        modal.show();
      }
    });

    // Symptom tag selection
    document.querySelectorAll(".symptom-tag").forEach((tag) => {
      tag.addEventListener("click", () => {
        tag.classList.toggle("selected");
      });
    });

    // Save note button
    document.getElementById("save-note-btn")?.addEventListener("click", () => {
      this.saveNote();
    });

    // Delete note button
    document
      .getElementById("delete-note-btn")
      ?.addEventListener("click", () => {
        this.deleteNote();
      });

    // Cancel note button and close button
    document
      .getElementById("cancel-note-btn")
      ?.addEventListener("click", () => {
        this.closeNoteModal();
      });

    // Close button (X) in note modal header
    document
      .querySelector('#note-modal [data-modal-hide="note-modal"]')
      ?.addEventListener("click", () => {
        this.closeNoteModal();
      });

    // Unified period modal buttons
    document
      .getElementById("period-delete-btn")
      ?.addEventListener("click", () => {
        this.deletePeriod();
      });

    // Cancel period button and close button
    document
      .getElementById("period-cancel-btn")
      ?.addEventListener("click", () => {
        this.closePeriodModal();
      });

    // Close button (X) in period modal header
    document
      .querySelector('#period-modal [data-modal-hide="period-modal"]')
      ?.addEventListener("click", () => {
        this.closePeriodModal();
      });

    // Data management
    document
      .getElementById("export-data-btn")
      ?.addEventListener("click", () => {
        this.exportData();
      });

    document
      .getElementById("import-data-btn")
      ?.addEventListener("click", () => {
        this.importData();
      });

    document.getElementById("clear-data-btn")?.addEventListener("click", () => {
      this.clearAllData();
    });

    // Settings modal handlers
    document.getElementById("settings-btn")?.addEventListener("click", () => {
      this.openSettingsModal();
    });

    document
      .getElementById("save-settings-btn")
      ?.addEventListener("click", () => {
        this.saveSettings();
      });

    // Cancel settings button and close button
    document
      .getElementById("cancel-settings-btn")
      ?.addEventListener("click", () => {
        this.closeSettingsModal();
      });

    // Close button (X) in settings modal header
    document
      .querySelector('#settings-modal [data-modal-hide="settings-modal"]')
      ?.addEventListener("click", () => {
        this.closeSettingsModal();
      });

    // Pill tracking events
    document.getElementById("take-pill-btn")?.addEventListener("click", () => {
      this.openPillModal();
    });

    document
      .getElementById("pill-taken-yes")
      ?.addEventListener("change", (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        const timeContainer = document.getElementById("pill-time-container");
        const reasonContainer = document.getElementById(
          "pill-missed-reason-container"
        );

        if (timeContainer) {
          timeContainer.style.display = isChecked ? "block" : "none";
        }
        if (reasonContainer) {
          reasonContainer.style.display = isChecked ? "none" : "block";
        }
      });

    document
      .getElementById("pill-taken-no")
      ?.addEventListener("change", (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        const timeContainer = document.getElementById("pill-time-container");
        const reasonContainer = document.getElementById(
          "pill-missed-reason-container"
        );

        if (timeContainer) {
          timeContainer.style.display = isChecked ? "none" : "block";
        }
        if (reasonContainer) {
          reasonContainer.style.display = isChecked ? "block" : "none";
        }
      });

    document.getElementById("save-pill-btn")?.addEventListener("click", () => {
      this.savePill();
    });

    document
      .getElementById("delete-pill-btn")
      ?.addEventListener("click", () => {
        this.deletePill();
      });

    document
      .getElementById("cancel-pill-btn")
      ?.addEventListener("click", () => {
        this.closePillModal();
      });

    // Close button (X) in pill modal header
    document
      .querySelector('#pill-modal [data-modal-hide="pill-modal"]')
      ?.addEventListener("click", () => {
        this.closePillModal();
      });

    // Pill tracking enable/disable toggle
    document
      .getElementById("pill-tracking-checkbox")
      ?.addEventListener("change", (e) => {
        const isEnabled = (e.target as HTMLInputElement).checked;
        const pillReminderDiv = document
          .getElementById("pill-reminder-checkbox")
          ?.closest("div");
        const pillTimeDiv = pillReminderDiv?.nextElementSibling;
        const pillComplianceDiv = pillTimeDiv?.nextElementSibling;

        if (pillReminderDiv) {
          (pillReminderDiv as HTMLElement).style.display = isEnabled
            ? "flex"
            : "none";
        }
        if (pillTimeDiv) {
          (pillTimeDiv as HTMLElement).style.display = isEnabled
            ? "block"
            : "none";
        }
        if (pillComplianceDiv) {
          (pillComplianceDiv as HTMLElement).style.display = isEnabled
            ? "block"
            : "none";
        }
      });

    // Handle window resize to update mobile/desktop note display
    window.addEventListener("resize", () => {
      // Debounce the resize event to avoid too many calendar refreshes
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.updateMobileState();
        this.refreshCalendar();
      }, 250);
    });
  }

  private openPeriodModal(
    mode: "start" | "edit" | "add",
    period?: Period,
    isCurrentPeriod?: boolean,
    periodIndex?: number
  ): void {
    this.isEditMode = mode === "edit";
    const isAddMode = mode === "add";

    // Set up modal UI based on mode
    const modalIcon = document.getElementById("period-modal-icon");
    const modalText = document.getElementById("period-modal-text");
    const modalDescription = document.getElementById(
      "period-modal-description"
    );
    const endDateContainer = document.getElementById(
      "period-end-date-container"
    );
    const primaryBtn = document.getElementById("period-primary-btn");
    const deleteBtn = document.getElementById("period-delete-btn");

    if (this.isEditMode) {
      // Edit mode setup
      if (modalIcon) modalIcon.textContent = "✏️";
      if (modalText) modalText.textContent = "Edit Period";
      if (modalDescription) {
        modalDescription.textContent =
          "You can modify the start and end dates of this period.";
      }
      if (endDateContainer) endDateContainer.classList.remove("hidden");
      if (primaryBtn) primaryBtn.textContent = "Save Changes";
      if (deleteBtn) deleteBtn.classList.remove("hidden");

      // Find the index of the period being edited
      if (isCurrentPeriod) {
        this.editingPeriodIndex = -2; // Special index for current period
      } else if (periodIndex !== undefined) {
        this.editingPeriodIndex = periodIndex;
      } else if (period) {
        this.editingPeriodIndex = this.data.periods.findIndex(
          (p) =>
            p.startDate === period.startDate && p.endDate === period.endDate
        );
      }

      // Populate the modal with current values
      const startDateInput = document.getElementById(
        "period-start-date"
      ) as HTMLInputElement;
      const endDateInput = document.getElementById(
        "period-end-date"
      ) as HTMLInputElement;

      if (startDateInput && period) {
        startDateInput.value = period.startDate;
      }
      if (endDateInput && period) {
        endDateInput.value = period.endDate || "";
      }
    } else if (isAddMode) {
      // Add mode setup - allows choosing both start and end dates
      if (modalIcon) modalIcon.textContent = "📅";
      if (modalText) modalText.textContent = "Add Period";
      if (modalDescription) {
        modalDescription.textContent =
          "Add a past period by selecting both start and end dates. This is useful for tracking historical data.";
      }
      if (endDateContainer) endDateContainer.classList.remove("hidden");
      if (primaryBtn) primaryBtn.textContent = "Add Period";
      if (deleteBtn) deleteBtn.classList.add("hidden");

      // Set default dates - suggest a 5-day period ending a week ago
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      const endDate = weekAgo.toISOString().split("T")[0];

      const startDateSuggestion = new Date(weekAgo);
      startDateSuggestion.setDate(weekAgo.getDate() - 4); // 5-day period
      const startDate = startDateSuggestion.toISOString().split("T")[0];

      const startDateInput = document.getElementById(
        "period-start-date"
      ) as HTMLInputElement;
      const endDateInput = document.getElementById(
        "period-end-date"
      ) as HTMLInputElement;

      if (startDateInput) {
        startDateInput.value = startDate;
      }
      if (endDateInput) {
        endDateInput.value = endDate;
      }
    } else {
      // Start mode setup
      if (modalIcon) modalIcon.textContent = "🩸";
      if (modalText) modalText.textContent = "Start Period";
      if (modalDescription) {
        modalDescription.textContent =
          "Select the date when your period started. You can choose today's date or a previous date.";
      }
      if (endDateContainer) endDateContainer.classList.add("hidden");
      if (primaryBtn) primaryBtn.textContent = "Start Period";
      if (deleteBtn) deleteBtn.classList.add("hidden");

      // Set default date to today
      const today = new Date().toISOString().split("T")[0];
      const startDateInput = document.getElementById(
        "period-start-date"
      ) as HTMLInputElement;
      if (startDateInput) {
        startDateInput.value = today;
      }
    }

    // Show the modal using Flowbite API
    const modal = this.getOrCreateModal("period-modal");
    if (modal) {
      modal.show();
    }
  }

  private handlePeriodSubmit(): void {
    if (this.isEditMode) {
      this.savePeriodChanges();
    } else {
      // Check if we're in add mode (both start and end date containers are visible)
      const endDateContainer = document.getElementById(
        "period-end-date-container"
      );
      const isAddMode =
        endDateContainer && !endDateContainer.classList.contains("hidden");

      if (isAddMode) {
        this.addCompletedPeriod();
      } else {
        this.confirmStartPeriod();
      }
    }
  }

  private confirmStartPeriod(): void {
    if (this.data.currentPeriod) return;

    const dateInput = document.getElementById(
      "period-start-date"
    ) as HTMLInputElement;
    const selectedDate = dateInput?.value;

    if (!selectedDate) {
      alert("Please select a start date");
      return;
    }

    this.data.currentPeriod = {
      startDate: selectedDate,
      endDate: null,
    };
    this.saveData();
    this.updateUI();
    this.refreshCalendar();

    this.closePeriodModal();
  }

  private addCompletedPeriod(): void {
    const startDateInput = document.getElementById(
      "period-start-date"
    ) as HTMLInputElement;
    const endDateInput = document.getElementById(
      "period-end-date"
    ) as HTMLInputElement;

    if (!startDateInput || !endDateInput) return;

    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!startDate) {
      alert("Please select a start date");
      return;
    }

    if (!endDate) {
      alert("Please select an end date");
      return;
    }

    // Validate that end date is after start date
    if (new Date(endDate) < new Date(startDate)) {
      alert("End date must be after start date");
      return;
    }

    // Check for overlapping periods
    const newPeriod: Period = { startDate, endDate };
    const hasOverlap = this.data.periods.some((period) => {
      if (!period.endDate) return false;

      const existingStart = new Date(period.startDate);
      const existingEnd = new Date(period.endDate);
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);

      // Check if periods overlap
      return newStart <= existingEnd && newEnd >= existingStart;
    });

    if (hasOverlap) {
      if (
        !confirm(
          "This period overlaps with an existing period. Do you want to add it anyway?"
        )
      ) {
        return;
      }
    }

    // Add the completed period
    this.data.periods.push(newPeriod);

    // Sort periods by start date
    this.data.periods.sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    this.saveData();
    this.updateUI();
    this.refreshCalendar();

    this.closePeriodModal();
  }

  private startPeriod(): void {
    if (this.data.currentPeriod) return;

    const today = new Date().toISOString().split("T")[0];
    this.data.currentPeriod = {
      startDate: today,
      endDate: null,
    };
    this.saveData();
    this.updateUI();
    this.refreshCalendar();
  }

  private endPeriod(): void {
    if (!this.data.currentPeriod) return;

    const today = new Date().toISOString().split("T")[0];
    this.data.currentPeriod.endDate = today;
    this.data.periods.push(this.data.currentPeriod);
    this.data.currentPeriod = null;
    this.saveData();
    this.updateUI();
    this.refreshCalendar();
  }

  private savePeriodChanges(): void {
    const startDateInput = document.getElementById(
      "period-start-date"
    ) as HTMLInputElement;
    const endDateInput = document.getElementById(
      "period-end-date"
    ) as HTMLInputElement;

    if (!startDateInput) return;

    const startDate = startDateInput.value;
    const endDate = endDateInput?.value || null;

    if (!startDate) {
      alert("Please select a start date");
      return;
    }

    // Update the period
    if (this.editingPeriodIndex === -2) {
      // Editing current period
      if (this.data.currentPeriod) {
        this.data.currentPeriod.startDate = startDate;
        this.data.currentPeriod.endDate = endDate;

        // If end date is provided, move to completed periods
        if (endDate) {
          this.data.periods.push(this.data.currentPeriod);
          this.data.currentPeriod = null;
        }
      }
    } else if (this.editingPeriodIndex >= 0) {
      // Editing completed period
      this.data.periods[this.editingPeriodIndex] = {
        startDate: startDate,
        endDate: endDate,
      };
    }

    this.saveData();
    this.updateUI();
    this.refreshCalendar();

    this.closePeriodModal();
  }

  private deletePeriod(): void {
    if (
      !confirm(
        "Are you sure you want to delete this period? This action cannot be undone."
      )
    ) {
      return;
    }

    // Delete the period
    if (this.editingPeriodIndex === -2) {
      // Deleting current period
      this.data.currentPeriod = null;
    } else if (this.editingPeriodIndex >= 0) {
      // Deleting completed period
      this.data.periods.splice(this.editingPeriodIndex, 1);
    }

    this.saveData();
    this.updateUI();
    this.refreshCalendar();

    this.closePeriodModal();
  }

  private closePeriodModal(): void {
    const modal = this.getOrCreateModal("period-modal");
    if (modal) {
      modal.hide();
    }

    // Reset state
    this.editingPeriodIndex = -1;
    this.isEditMode = false;
  }

  private saveNote(): void {
    const noteDateInput = document.getElementById(
      "note-date"
    ) as HTMLInputElement;
    const noteTextArea = document.getElementById(
      "note-text"
    ) as HTMLTextAreaElement;

    if (!noteDateInput || !noteTextArea) return;

    const date = noteDateInput.value;
    const notes = noteTextArea.value;

    // Get selected symptoms
    const selectedSymptoms: string[] = [];
    document.querySelectorAll(".symptom-tag.selected").forEach((tag) => {
      const symptom = tag.getAttribute("data-symptom");
      if (symptom) selectedSymptoms.push(symptom);
    });

    // Find existing note or create new one
    const existingNoteIndex = this.data.notes.findIndex(
      (note) => note.date === date
    );
    const noteData: DailyNote = {
      date,
      symptoms: selectedSymptoms,
      notes,
    };

    if (existingNoteIndex >= 0) {
      this.data.notes[existingNoteIndex] = noteData;
    } else {
      this.data.notes.push(noteData);
    }

    this.saveData();
    this.refreshCalendar();

    // Hide modal
    const modal = this.getOrCreateModal("note-modal");
    if (modal) {
      modal.hide();
    }
  }

  private deleteNote(): void {
    const noteDateInput = document.getElementById(
      "note-date"
    ) as HTMLInputElement;
    if (!noteDateInput) return;

    const date = noteDateInput.value;
    if (!date) return;

    // Find and remove the note
    const noteIndex = this.data.notes.findIndex((note) => note.date === date);
    if (noteIndex >= 0) {
      this.data.notes.splice(noteIndex, 1);
      this.saveData();
      this.refreshCalendar();
    }

    // Close modal
    this.closeNoteModal();
  }

  private closeNoteModal(): void {
    const modal = this.getOrCreateModal("note-modal");
    if (modal) {
      modal.hide();
    }

    // Clear the form
    this.clearNoteModal();
  }

  private updateUI(): void {
    const statusElement = document.getElementById("cycle-status");
    const infoElement = document.getElementById("cycle-info");
    const daysInfoElement = document.getElementById("days-info");
    const startBtn = document.getElementById(
      "start-period-btn"
    ) as HTMLButtonElement;
    const endBtn = document.getElementById(
      "end-period-btn"
    ) as HTMLButtonElement;
    const indicatorElement = document.getElementById("status-indicator");

    if (this.data.currentPeriod) {
      const days = this.getDaysSince(this.data.currentPeriod.startDate);
      if (statusElement) statusElement.textContent = "Period in progress";
      if (infoElement)
        infoElement.textContent = `Day ${days + 1} of your period`;
      if (daysInfoElement)
        daysInfoElement.textContent = `Started ${this.formatDate(
          this.data.currentPeriod.startDate
        )}`;
      if (indicatorElement) {
        indicatorElement.innerHTML =
          '<div class="w-12 h-12 bg-red-900 rounded-full flex items-center justify-center"><span class="text-2xl">🔴</span></div>';
      }
      if (startBtn) {
        startBtn.disabled = true;
        startBtn.title =
          "You have an ongoing period. End it first to start a new one.";
      }
      if (endBtn) endBtn.disabled = false;
    } else {
      if (statusElement) statusElement.textContent = "Track your cycle";
      if (infoElement)
        infoElement.textContent =
          "Start tracking to see your cycle information";
      if (daysInfoElement) daysInfoElement.textContent = "";
      if (indicatorElement) {
        indicatorElement.innerHTML =
          '<div class="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center"><span class="text-2xl">🌙</span></div>';
      }
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.title = "Start tracking your period";
      }
      if (endBtn) endBtn.disabled = true;
    }

    this.updateStats();

    // Update pill UI based on pill tracking setting
    this.updatePillUI();
  }

  private updateStats(): void {
    const periodDaysElement = document.getElementById("period-days-count");
    const periodDaysTitleElement = document.getElementById("period-days-title");
    const periodDaysSubtitleElement = document.getElementById(
      "period-days-subtitle"
    );
    const cycleLengthElement = document.getElementById("cycle-length-avg");

    let periodDaysCount = 0;
    let avgCycleLength = 0;

    // Always show period days for this month
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const today = new Date().toISOString().split("T")[0];

    // Count completed periods in this month
    this.data.periods.forEach((period: Period) => {
      const startDate = new Date(period.startDate);
      if (
        startDate.getMonth() === thisMonth &&
        startDate.getFullYear() === thisYear
      ) {
        if (period.endDate) {
          const endDate = new Date(period.endDate);
          periodDaysCount +=
            Math.ceil(
              (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
            ) + 1;
        }
      }
    });

    // Include current period days if it started this month
    if (this.data.currentPeriod) {
      const currentPeriodStart = new Date(this.data.currentPeriod.startDate);
      if (
        currentPeriodStart.getMonth() === thisMonth &&
        currentPeriodStart.getFullYear() === thisYear
      ) {
        const currentPeriodDays = this.calculateDuration(
          this.data.currentPeriod.startDate,
          today
        );
        periodDaysCount += currentPeriodDays;
      }
    }

    avgCycleLength = this.getAverageCycleLength();

    // Update the UI elements - always show "Period Days" and "This month"
    if (periodDaysElement)
      periodDaysElement.textContent =
        periodDaysCount > 0 ? periodDaysCount.toString() : "-";
    if (periodDaysTitleElement)
      periodDaysTitleElement.textContent = "Period Days";
    if (periodDaysSubtitleElement) {
      if (periodDaysCount > 0) {
        periodDaysSubtitleElement.textContent = "This month";
      } else {
        periodDaysSubtitleElement.textContent = "No periods this month";
      }
    }
    if (cycleLengthElement)
      cycleLengthElement.textContent = avgCycleLength
        ? `${avgCycleLength}`
        : "-";

    // Update pill streak
    this.updatePillStreak();
  }

  private updatePillStreak(): void {
    const pillStreakElement = document.getElementById("pill-streak-count");
    const pillStreakCard = document.getElementById("pill-streak-card");

    if (!pillStreakElement || !pillStreakCard) return;

    // Show/hide pill streak card based on pill tracking setting
    if (!this.data.settings.pillTrackingEnabled) {
      pillStreakCard.style.display = "none";
      return;
    } else {
      pillStreakCard.style.display = "block";
    }

    const currentStreak = this.calculatePillStreak();
    pillStreakElement.textContent =
      currentStreak > 0 ? currentStreak.toString() : "-";
  }

  private calculatePillStreak(): number {
    if (
      !this.data.settings.pillTrackingEnabled ||
      !this.data.pillsTaken ||
      this.data.pillsTaken.length === 0
    ) {
      return 0;
    }

    // Sort pills by date in descending order (most recent first)
    const sortedPills = [...this.data.pillsTaken]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .filter((pill) => pill.taken); // Only count taken pills

    if (sortedPills.length === 0) {
      return 0;
    }

    const today = new Date().toISOString().split("T")[0];
    let streak = 0;
    let currentDate = today;

    // Check if today's pill is taken
    const todayPill = this.data.pillsTaken.find((pill) => pill.date === today);
    if (!todayPill || !todayPill.taken) {
      // If today's pill isn't taken, check yesterday and continue from there
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      currentDate = yesterday.toISOString().split("T")[0];
    }

    // Count consecutive days of taken pills going backwards
    for (const pill of sortedPills) {
      if (pill.date === currentDate && pill.taken) {
        streak++;
        // Move to previous day
        const prevDate = new Date(currentDate);
        prevDate.setDate(prevDate.getDate() - 1);
        currentDate = prevDate.toISOString().split("T")[0];
      } else if (pill.date < currentDate) {
        // Gap found - check if it's within pill schedule (accounting for break days)
        const pillDate = new Date(pill.date);
        const expectedDate = new Date(currentDate);
        const daysDiff = Math.floor(
          (expectedDate.getTime() - pillDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // If the gap is more than 1 day, and it's not during a break week, streak is broken
        if (daysDiff > 1) {
          // Check if this gap falls within a planned break week
          if (!this.isWithinBreakWeek(pill.date, currentDate)) {
            break; // Streak is broken
          }
        }

        if (pill.date === currentDate && pill.taken) {
          streak++;
          const prevDate = new Date(currentDate);
          prevDate.setDate(prevDate.getDate() - 1);
          currentDate = prevDate.toISOString().split("T")[0];
        }
      }
    }

    return streak;
  }

  private isWithinBreakWeek(pillDate: string, expectedDate: string): boolean {
    // Find the first pill to establish the pack cycle
    if (!this.data.pillsTaken || this.data.pillsTaken.length === 0) {
      return false;
    }

    const sortedPills = [...this.data.pillsTaken].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const firstPillDate = sortedPills[0].date;

    const packDays = this.data.settings.pillPackDays;
    const breakDays = 7;
    const fullCycleDays = packDays + breakDays;

    // Calculate which day of the cycle the expected date would be
    const daysSinceFirstPill = Math.floor(
      (new Date(expectedDate).getTime() - new Date(firstPillDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const dayInCycle = (daysSinceFirstPill % fullCycleDays) + 1;

    // If it's during the break week (after pack days), it's acceptable to not have a pill
    return dayInCycle > packDays;
  }

  private getAverageCycleLength(): number {
    if (this.data.periods.length >= 2) {
      let totalCycleDays = 0;
      for (let i = 1; i < this.data.periods.length; i++) {
        const prevStart = new Date(this.data.periods[i - 1].startDate);
        const currentStart = new Date(this.data.periods[i].startDate);
        totalCycleDays += Math.ceil(
          (currentStart.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
      return Math.round(totalCycleDays / (this.data.periods.length - 1));
    }
    return 0;
  }

  private refreshCalendar(): void {
    if (this.calendar) {
      const events = this.generateCalendarEvents();
      this.calendar.removeAllEvents();
      this.calendar.addEventSource(events);
    }
  }

  private getDaysSince(dateString: string): number {
    const startDate = new Date(dateString);
    const today = new Date();
    const timeDiff = today.getTime() - startDate.getTime();
    return Math.floor(timeDiff / (1000 * 3600 * 24));
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  private exportData(): void {
    const dataStr = JSON.stringify(this.data, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "period-tracker-data.json";
    link.click();

    URL.revokeObjectURL(url);
  }

  private importData(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const importedData = JSON.parse(e.target?.result as string);
            this.data = importedData;
            this.saveData();
            this.updateUI();
            this.refreshCalendar();
            alert("Data imported successfully!");
          } catch (error) {
            alert("Error importing data. Please check the file format.");
          }
        };
        reader.readAsText(file);
      }
    };

    input.click();
  }

  private clearAllData(): void {
    if (
      confirm(
        "Are you sure you want to clear all data? This action cannot be undone."
      )
    ) {
      this.data = {
        periods: [],
        currentPeriod: null,
        notes: [],
        pillsTaken: [],
        settings: {
          cycleLength: 28,
          periodLength: 5,
          showNextPeriodPrediction: true,
          showOvulation: true,
          showSafeDays: false,
          pillTrackingEnabled: false,
          pillReminderEnabled: false,
          pillReminderTime: "21:00",
          showPillsOnCalendar: true,
          pillPackDays: 21,
        },
      };
      this.saveData();
      this.updateUI();
      this.refreshCalendar();
    }
  }

  private populateSettingsModal(): void {
    // Populate the settings modal with current values
    const cycleLengthInput = document.getElementById(
      "cycle-length-setting"
    ) as HTMLInputElement;
    const periodLengthInput = document.getElementById(
      "period-length-setting"
    ) as HTMLInputElement;
    const showNextPeriodCheckbox = document.getElementById(
      "show-next-period-checkbox"
    ) as HTMLInputElement;
    const showOvulationCheckbox = document.getElementById(
      "show-ovulation-checkbox"
    ) as HTMLInputElement;
    const showSafeDaysCheckbox = document.getElementById(
      "show-safe-days-checkbox"
    ) as HTMLInputElement;
    const pillTrackingCheckbox = document.getElementById(
      "pill-tracking-checkbox"
    ) as HTMLInputElement;
    const pillReminderCheckbox = document.getElementById(
      "pill-reminder-checkbox"
    ) as HTMLInputElement;
    const pillReminderTimeInput = document.getElementById(
      "pill-reminder-time"
    ) as HTMLInputElement;
    const pillPackDaysInput = document.getElementById(
      "pill-pack-days"
    ) as HTMLInputElement;
    const showPillsCheckbox = document.getElementById(
      "show-pills-checkbox"
    ) as HTMLInputElement;

    if (cycleLengthInput) {
      cycleLengthInput.value = this.data.settings.cycleLength.toString();
    }
    if (periodLengthInput) {
      periodLengthInput.value = this.data.settings.periodLength.toString();
    }
    if (showNextPeriodCheckbox) {
      showNextPeriodCheckbox.checked =
        this.data.settings.showNextPeriodPrediction;
    }
    if (showOvulationCheckbox) {
      showOvulationCheckbox.checked = this.data.settings.showOvulation;
    }
    if (showSafeDaysCheckbox) {
      showSafeDaysCheckbox.checked = this.data.settings.showSafeDays;
    }
    if (pillTrackingCheckbox) {
      pillTrackingCheckbox.checked = this.data.settings.pillTrackingEnabled;
    }
    if (pillReminderCheckbox) {
      pillReminderCheckbox.checked = this.data.settings.pillReminderEnabled;
    }
    if (pillReminderTimeInput) {
      pillReminderTimeInput.value = this.data.settings.pillReminderTime;
    }
    if (pillPackDaysInput) {
      pillPackDaysInput.value = this.data.settings.pillPackDays.toString();
    }
    if (showPillsCheckbox) {
      showPillsCheckbox.checked = this.data.settings.showPillsOnCalendar;
    }

    // Show/hide pill settings based on pill tracking enabled status
    this.togglePillSettingsVisibility();
  }

  private togglePillSettingsVisibility(): void {
    const isEnabled = this.data.settings.pillTrackingEnabled;
    const pillReminderDiv = document
      .getElementById("pill-reminder-checkbox")
      ?.closest("div");
    const pillTimeDiv = pillReminderDiv?.nextElementSibling;
    const pillPackDiv = pillTimeDiv?.nextElementSibling;
    const pillComplianceDiv = pillPackDiv?.nextElementSibling;

    if (pillReminderDiv) {
      (pillReminderDiv as HTMLElement).style.display = isEnabled
        ? "flex"
        : "none";
    }
    if (pillTimeDiv) {
      (pillTimeDiv as HTMLElement).style.display = isEnabled ? "block" : "none";
    }
    if (pillPackDiv) {
      (pillPackDiv as HTMLElement).style.display = isEnabled ? "block" : "none";
    }
    if (pillComplianceDiv) {
      (pillComplianceDiv as HTMLElement).style.display = isEnabled
        ? "block"
        : "none";
    }
  }

  private openSettingsModal(): void {
    // Populate the settings modal with current values
    this.populateSettingsModal();

    // Show the modal
    const modal = this.getOrCreateModal("settings-modal");
    if (modal) {
      modal.show();
    }
  }

  private saveSettings(): void {
    // Get values from the settings modal
    const cycleLengthInput = document.getElementById(
      "cycle-length-setting"
    ) as HTMLInputElement;
    const periodLengthInput = document.getElementById(
      "period-length-setting"
    ) as HTMLInputElement;
    const showNextPeriodCheckbox = document.getElementById(
      "show-next-period-checkbox"
    ) as HTMLInputElement;
    const showOvulationCheckbox = document.getElementById(
      "show-ovulation-checkbox"
    ) as HTMLInputElement;
    const showSafeDaysCheckbox = document.getElementById(
      "show-safe-days-checkbox"
    ) as HTMLInputElement;
    const pillTrackingCheckbox = document.getElementById(
      "pill-tracking-checkbox"
    ) as HTMLInputElement;
    const pillReminderCheckbox = document.getElementById(
      "pill-reminder-checkbox"
    ) as HTMLInputElement;
    const pillReminderTimeInput = document.getElementById(
      "pill-reminder-time"
    ) as HTMLInputElement;
    const pillPackDaysInput = document.getElementById(
      "pill-pack-days"
    ) as HTMLInputElement;

    // Validate inputs
    const cycleLength = parseInt(cycleLengthInput?.value || "28");
    const periodLength = parseInt(periodLengthInput?.value || "5");
    const pillPackDays = parseInt(pillPackDaysInput?.value || "21");

    if (cycleLength < 21 || cycleLength > 40) {
      alert("Cycle length must be between 21 and 40 days");
      return;
    }

    if (periodLength < 1 || periodLength > 10) {
      alert("Period length must be between 1 and 10 days");
      return;
    }

    if (periodLength >= cycleLength) {
      alert("Period length must be less than cycle length");
      return;
    }

    if (pillPackDays < 14 || pillPackDays > 28) {
      alert("Pill pack days must be between 14 and 28 days");
      return;
    }

    // Update settings
    this.data.settings.cycleLength = cycleLength;
    this.data.settings.periodLength = periodLength;
    this.data.settings.showNextPeriodPrediction =
      showNextPeriodCheckbox?.checked ?? true;
    this.data.settings.showOvulation = showOvulationCheckbox?.checked ?? true;
    this.data.settings.showSafeDays = showSafeDaysCheckbox?.checked ?? false;
    this.data.settings.pillTrackingEnabled =
      pillTrackingCheckbox?.checked ?? false;
    this.data.settings.pillReminderEnabled =
      pillReminderCheckbox?.checked ?? false;
    this.data.settings.pillReminderTime =
      pillReminderTimeInput?.value || "21:00";
    this.data.settings.pillPackDays = pillPackDays;

    // Save and refresh
    this.saveData();
    this.updateUI();
    this.refreshCalendar();

    // Close the modal
    this.closeSettingsModal();
  }

  private closeSettingsModal(): void {
    const modal = this.getOrCreateModal("settings-modal");
    if (modal) {
      modal.hide();
    }
  }

  // Pill Modal Methods
  private openPillModal(pill?: PillTaken): void {
    const pillDate = pill?.date || new Date().toISOString().split("T")[0];

    // Set the date in the modal
    const pillDateInput = document.getElementById(
      "pill-date"
    ) as HTMLInputElement;
    if (pillDateInput) {
      pillDateInput.value = pillDate;
    }

    // Set the current state
    this.populatePillModal(pill);

    // Show the modal
    const modal = this.getOrCreateModal("pill-modal");
    if (modal) {
      modal.show();
    }
  }

  private populatePillModal(pill?: PillTaken): void {
    const pillTakenRadio = document.getElementById(
      "pill-taken-yes"
    ) as HTMLInputElement;
    const pillMissedRadio = document.getElementById(
      "pill-taken-no"
    ) as HTMLInputElement;
    const pillTimeInput = document.getElementById(
      "pill-time"
    ) as HTMLInputElement;
    const pillMissedReasonInput = document.getElementById(
      "pill-missed-reason"
    ) as HTMLTextAreaElement;
    const deletePillBtn = document.getElementById(
      "delete-pill-btn"
    ) as HTMLButtonElement;
    const pillTimeContainer = document.getElementById("pill-time-container");
    const pillMissedReasonContainer = document.getElementById(
      "pill-missed-reason-container"
    );

    if (pill) {
      // Existing pill - populate with current values
      if (pillTakenRadio && pillMissedRadio) {
        pillTakenRadio.checked = pill.taken;
        pillMissedRadio.checked = !pill.taken;
      }

      if (pillTimeInput && pill.time) {
        pillTimeInput.value = pill.time;
      }

      if (pillMissedReasonInput && pill.missedReason) {
        pillMissedReasonInput.value = pill.missedReason;
      }

      // Show delete button for existing pills
      if (deletePillBtn) {
        deletePillBtn.style.display = "inline-flex";
      }

      // Show/hide appropriate containers
      if (pillTimeContainer) {
        pillTimeContainer.style.display = pill.taken ? "block" : "none";
      }
      if (pillMissedReasonContainer) {
        pillMissedReasonContainer.style.display = pill.taken ? "none" : "block";
      }
    } else {
      // New pill - set defaults
      if (pillTakenRadio) {
        pillTakenRadio.checked = true;
      }
      if (pillMissedRadio) {
        pillMissedRadio.checked = false;
      }

      // Set default time to reminder time or current time
      if (pillTimeInput) {
        const now = new Date();
        const defaultTime =
          this.data.settings.pillReminderTime ||
          `${now.getHours().toString().padStart(2, "0")}:${now
            .getMinutes()
            .toString()
            .padStart(2, "0")}`;
        pillTimeInput.value = defaultTime;
      }

      if (pillMissedReasonInput) {
        pillMissedReasonInput.value = "";
      }

      // Hide delete button for new pills
      if (deletePillBtn) {
        deletePillBtn.style.display = "none";
      }

      // Show time container, hide missed reason container by default
      if (pillTimeContainer) {
        pillTimeContainer.style.display = "block";
      }
      if (pillMissedReasonContainer) {
        pillMissedReasonContainer.style.display = "none";
      }
    }
  }

  private savePill(): void {
    const pillDateInput = document.getElementById(
      "pill-date"
    ) as HTMLInputElement;
    const pillTakenRadio = document.getElementById(
      "pill-taken-yes"
    ) as HTMLInputElement;
    const pillTimeInput = document.getElementById(
      "pill-time"
    ) as HTMLInputElement;
    const pillMissedReasonInput = document.getElementById(
      "pill-missed-reason"
    ) as HTMLTextAreaElement;

    if (!pillDateInput) return;

    const date = pillDateInput.value;
    const taken = pillTakenRadio?.checked ?? true;
    const time = taken ? pillTimeInput?.value || "" : undefined;
    const missedReason = !taken
      ? pillMissedReasonInput?.value || ""
      : undefined;

    if (!date) {
      alert("Please select a date");
      return;
    }

    // Create or update pill record
    const pillData: PillTaken = {
      date,
      taken,
      time,
      missedReason,
    };

    // Find existing pill record for this date
    const existingPillIndex = this.data.pillsTaken.findIndex(
      (pill) => pill.date === date
    );

    if (existingPillIndex >= 0) {
      this.data.pillsTaken[existingPillIndex] = pillData;
    } else {
      this.data.pillsTaken.push(pillData);
    }

    // Sort pills by date
    this.data.pillsTaken.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    this.saveData();
    this.updatePillStats();
    this.refreshCalendar();
    this.closePillModal();
  }

  private deletePill(): void {
    const pillDateInput = document.getElementById(
      "pill-date"
    ) as HTMLInputElement;
    if (!pillDateInput) return;

    const date = pillDateInput.value;
    if (!date) return;

    if (!confirm("Are you sure you want to delete this pill record?")) {
      return;
    }

    // Find and remove the pill record
    const pillIndex = this.data.pillsTaken.findIndex(
      (pill) => pill.date === date
    );
    if (pillIndex >= 0) {
      this.data.pillsTaken.splice(pillIndex, 1);
      this.saveData();
      this.updatePillStats();
      this.refreshCalendar();
    }

    this.closePillModal();
  }

  private closePillModal(): void {
    const modal = this.getOrCreateModal("pill-modal");
    if (modal) {
      modal.hide();
    }
  }

  private updatePillStats(): void {
    // Update the pill streak display
    this.updatePillStreak();

    // Update pill compliance if needed
    const pillComplianceElement = document.getElementById(
      "pill-compliance-count"
    );
    if (!pillComplianceElement) return;

    // Calculate compliance for last 30 days
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const pillsInLast30Days = this.data.pillsTaken.filter((pill) => {
      const pillDate = new Date(pill.date);
      return pillDate >= thirtyDaysAgo && pillDate <= today;
    });

    const takenPills = pillsInLast30Days.filter((pill) => pill.taken);
    const compliance =
      pillsInLast30Days.length > 0
        ? Math.round((takenPills.length / pillsInLast30Days.length) * 100)
        : 100;

    pillComplianceElement.textContent = `${compliance}%`;
  }

  private updatePillUI(): void {
    const pillStreakCard = document.getElementById("pill-streak-card");
    const takePillBtn = document.getElementById("take-pill-btn");

    if (this.data.settings.pillTrackingEnabled) {
      // Show pill-related UI elements
      if (pillStreakCard) {
        pillStreakCard.style.display = "block";
      }
      if (takePillBtn) {
        takePillBtn.style.display = "inline-flex";
      }

      // Update pill stats
      this.updatePillStats();
    } else {
      // Hide pill-related UI elements
      if (pillStreakCard) {
        pillStreakCard.style.display = "none";
      }
      if (takePillBtn) {
        takePillBtn.style.display = "none";
      }
    }

    // Always update pill settings visibility (this handles sub-settings)
    this.togglePillSettingsVisibility();
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new PeriodTrackerFlowbite();
});
