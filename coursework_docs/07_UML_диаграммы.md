# UML-диаграммы

## 1 Диаграмма вариантов использования (Use Case)

```mermaid
flowchart LR
    admin["Администратор"]
    coach["Тренер"]
    client["Клиент"]

    uc1(("Управление пользователями"))
    uc2(("Управление клиентами"))
    uc3(("Ведение расписания"))
    uc4(("Управление бронированиями"))
    uc5(("Учет платежей"))
    uc6(("Просмотр отчетов"))
    uc7(("Личный кабинет"))
    uc8(("Авторизация"))

    admin --> uc1
    admin --> uc2
    admin --> uc3
    admin --> uc4
    admin --> uc5
    admin --> uc6
    admin --> uc8

    coach --> uc2
    coach --> uc3
    coach --> uc4
    coach --> uc5
    coach --> uc8

    client --> uc4
    client --> uc7
    client --> uc8
```

## 2 Диаграмма классов (логическая модель)

```mermaid
classDiagram
    class User {
      +id: int
      +name: string
      +email: string
      +role: string
      +passwordHash: string
    }

    class Member {
      +id: int
      +name: string
      +phone: string
      +email: string
      +status: string
    }

    class Trainer {
      +id: int
      +name: string
      +specialization: string
    }

    class Class {
      +id: int
      +title: string
      +date: string
      +time: string
      +trainerId: int
    }

    class Booking {
      +id: int
      +memberId: int
      +classId: int
      +status: string
    }

    class Payment {
      +id: int
      +memberId: int
      +amount: decimal
      +method: string
      +status: string
      +date: string
    }

    User "1" --> "0..*" Member : manages
    Trainer "1" --> "0..*" Class : leads
    Member "1" --> "0..*" Booking : creates
    Class "1" --> "0..*" Booking : contains
    Member "1" --> "0..*" Payment : pays
```

## 3 Диаграмма последовательности (создание бронирования)

```mermaid
sequenceDiagram
    actor U as Пользователь
    participant FE as Frontend
    participant API as Backend API
    participant DB as SQLite

    U->>FE: Заполнить форму бронирования
    FE->>API: POST /api/bookings
    API->>DB: INSERT booking
    DB-->>API: OK / ошибка
    API-->>FE: JSON с результатом
    FE-->>U: Сообщение об успешном создании
```

## 4 Диаграмма состояний (сущность «Платеж»)

```mermaid
stateDiagram-v2
    [*] --> Создан
    Создан --> Неоплачен
    Неоплачен --> Оплачен: подтверждение оплаты
    Неоплачен --> Ошибка: сбой операции
    Ошибка --> Неоплачен: повторная попытка
    Оплачен --> [*]
```

## Примечание

Для печатной версии рекомендуется перерисовать диаграммы в UML-редакторе (StarUML, draw.io, PlantUML) с подписями рисунков и нумерацией по требованиям кафедры.
