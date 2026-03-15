CREATE TABLE members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT,
          phone TEXT,
          membership TEXT,
          joinDate TEXT,
          status TEXT
        );
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE trainers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT,
          phone TEXT,
          specialty TEXT,
          experience TEXT,
          members INTEGER,
          rating REAL
        );
CREATE TABLE classes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          trainerId INTEGER,
          trainerName TEXT,
          schedule TEXT,
          capacity INTEGER,
          enrolled INTEGER,
          level TEXT
        );
CREATE TABLE bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member TEXT,
          classId INTEGER,
          className TEXT,
          date TEXT,
          time TEXT,
          status TEXT
        );
CREATE TABLE payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          member TEXT,
          amount INTEGER,
          method TEXT,
          date TEXT,
          status TEXT,
          receiptId INTEGER,
          provider TEXT
        );
CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          email TEXT UNIQUE,
          phone TEXT,
          role TEXT,
          password TEXT
        );
CREATE TABLE sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER,
          token TEXT UNIQUE,
          createdAt TEXT,
          expiresAt TEXT
        );
CREATE TABLE services (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          category TEXT,
          price INTEGER,
          unit TEXT,
          description TEXT
        );
CREATE TABLE notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT,
          title TEXT,
          message TEXT,
          createdAt TEXT,
          isRead INTEGER DEFAULT 0,
          refType TEXT,
          refId TEXT
        );
CREATE TABLE membership_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          price INTEGER,
          period TEXT,
          visits TEXT,
          perksJson TEXT
        );
CREATE TABLE crm_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memberId INTEGER,
          text TEXT,
          createdAt TEXT
        );
CREATE TABLE calendar_slots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT,
          time TEXT,
          className TEXT,
          trainer TEXT,
          capacity INTEGER,
          booked INTEGER
        );
CREATE TABLE receipts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          memberId INTEGER,
          memberName TEXT,
          membership TEXT,
          itemsJson TEXT,
          subtotal INTEGER,
          discount INTEGER,
          total INTEGER,
          createdAt TEXT,
          note TEXT,
          paymentId INTEGER
        );
CREATE TABLE deals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client TEXT,
          offer TEXT,
          value INTEGER,
          stage TEXT,
          probability INTEGER,
          manager TEXT,
          nextStep TEXT,
          date TEXT
        );
CREATE TABLE demand_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          month TEXT,
          visits INTEGER,
          pool INTEGER,
          tennis INTEGER
        );
CREATE TABLE workout_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          description TEXT,
          category TEXT,
          level TEXT,
          duration INTEGER,
          defaultCapacity INTEGER,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
CREATE TABLE schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(userId);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_membership ON members(membership);
CREATE INDEX idx_bookings_member ON bookings(member);
CREATE INDEX idx_bookings_class_id ON bookings(classId);
CREATE INDEX idx_bookings_date ON bookings(date);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_payments_member ON payments(member);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_date ON payments(date);
CREATE INDEX idx_payments_receipt_id ON payments(receiptId);
CREATE INDEX idx_notifications_ref ON notifications(refType, refId);
CREATE INDEX idx_notifications_created ON notifications(createdAt);
CREATE INDEX idx_receipts_member_id ON receipts(memberId);
CREATE INDEX idx_receipts_created ON receipts(createdAt);
CREATE INDEX idx_crm_notes_member_id ON crm_notes(memberId);
CREATE INDEX idx_deals_stage ON deals(stage);
CREATE INDEX idx_deals_manager ON deals(manager);
CREATE TRIGGER trg_sessions_user_fk_insert
        BEFORE INSERT ON sessions
        FOR EACH ROW
        WHEN NEW.userId IS NULL OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.userId)
        BEGIN
            SELECT RAISE(ABORT, 'sessions.userId references missing user');
        END;
CREATE TRIGGER trg_sessions_user_fk_update
        BEFORE UPDATE OF userId ON sessions
        FOR EACH ROW
        WHEN NEW.userId IS NULL OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.userId)
        BEGIN
            SELECT RAISE(ABORT, 'sessions.userId references missing user');
        END;
CREATE TRIGGER trg_classes_trainer_fk_insert
        BEFORE INSERT ON classes
        FOR EACH ROW
        WHEN NEW.trainerId IS NOT NULL
             AND NEW.trainerId != 0
             AND NOT EXISTS (SELECT 1 FROM trainers WHERE id = NEW.trainerId)
        BEGIN
            SELECT RAISE(ABORT, 'classes.trainerId references missing trainer');
        END;
CREATE TRIGGER trg_classes_trainer_fk_update
        BEFORE UPDATE OF trainerId ON classes
        FOR EACH ROW
        WHEN NEW.trainerId IS NOT NULL
             AND NEW.trainerId != 0
             AND NOT EXISTS (SELECT 1 FROM trainers WHERE id = NEW.trainerId)
        BEGIN
            SELECT RAISE(ABORT, 'classes.trainerId references missing trainer');
        END;
CREATE TRIGGER trg_bookings_class_fk_insert
        BEFORE INSERT ON bookings
        FOR EACH ROW
        WHEN NEW.classId IS NOT NULL
             AND NEW.classId != 0
             AND NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.classId)
        BEGIN
            SELECT RAISE(ABORT, 'bookings.classId references missing class');
        END;
CREATE TRIGGER trg_bookings_class_fk_update
        BEFORE UPDATE OF classId ON bookings
        FOR EACH ROW
        WHEN NEW.classId IS NOT NULL
             AND NEW.classId != 0
             AND NOT EXISTS (SELECT 1 FROM classes WHERE id = NEW.classId)
        BEGIN
            SELECT RAISE(ABORT, 'bookings.classId references missing class');
        END;
CREATE TRIGGER trg_payments_receipt_fk_insert
        BEFORE INSERT ON payments
        FOR EACH ROW
        WHEN NEW.receiptId IS NOT NULL
             AND NEW.receiptId != 0
             AND NOT EXISTS (SELECT 1 FROM receipts WHERE id = NEW.receiptId)
        BEGIN
            SELECT RAISE(ABORT, 'payments.receiptId references missing receipt');
        END;
CREATE TRIGGER trg_payments_receipt_fk_update
        BEFORE UPDATE OF receiptId ON payments
        FOR EACH ROW
        WHEN NEW.receiptId IS NOT NULL
             AND NEW.receiptId != 0
             AND NOT EXISTS (SELECT 1 FROM receipts WHERE id = NEW.receiptId)
        BEGIN
            SELECT RAISE(ABORT, 'payments.receiptId references missing receipt');
        END;
CREATE TRIGGER trg_crm_notes_member_fk_insert
        BEFORE INSERT ON crm_notes
        FOR EACH ROW
        WHEN NEW.memberId IS NULL
             OR NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.memberId)
        BEGIN
            SELECT RAISE(ABORT, 'crm_notes.memberId references missing member');
        END;
CREATE TRIGGER trg_crm_notes_member_fk_update
        BEFORE UPDATE OF memberId ON crm_notes
        FOR EACH ROW
        WHEN NEW.memberId IS NULL
             OR NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.memberId)
        BEGIN
            SELECT RAISE(ABORT, 'crm_notes.memberId references missing member');
        END;
CREATE TRIGGER trg_receipts_member_fk_insert
        BEFORE INSERT ON receipts
        FOR EACH ROW
        WHEN NEW.memberId IS NULL
             OR NEW.memberId = 0
             OR NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.memberId)
        BEGIN
            SELECT RAISE(ABORT, 'receipts.memberId references missing member');
        END;
CREATE TRIGGER trg_receipts_member_fk_update
        BEFORE UPDATE OF memberId ON receipts
        FOR EACH ROW
        WHEN NEW.memberId IS NULL
             OR NEW.memberId = 0
             OR NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.memberId)
        BEGIN
            SELECT RAISE(ABORT, 'receipts.memberId references missing member');
        END;
CREATE TRIGGER trg_payments_amount_insert
        BEFORE INSERT ON payments
        FOR EACH ROW
        WHEN NEW.amount IS NULL OR NEW.amount < 0
        BEGIN
            SELECT RAISE(ABORT, 'payments.amount must be >= 0');
        END;
CREATE TRIGGER trg_payments_amount_update
        BEFORE UPDATE OF amount ON payments
        FOR EACH ROW
        WHEN NEW.amount IS NULL OR NEW.amount < 0
        BEGIN
            SELECT RAISE(ABORT, 'payments.amount must be >= 0');
        END;
CREATE TABLE vk_accounts (
          vkUserId TEXT PRIMARY KEY,
          userId INTEGER NOT NULL UNIQUE,
          profileJson TEXT NOT NULL DEFAULT '{}',
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
        );
CREATE INDEX idx_vk_accounts_user_id ON vk_accounts(userId);
