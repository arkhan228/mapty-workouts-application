'use strict';

const form = document.querySelector('.form');
const formEdit = document.querySelector('.form__edit');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const invalidMessage = document.getElementById('message');

let map, mapEvent;

class Workout {
  constructor(date, coords, distance, duration) {
    this.date = date;
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  _createID() {
    this.id = (this.date.getTime() + '').slice(-12);
  }
}

class Running extends Workout {
  type = 'running';
  constructor(date, coords, distance, duration, cadence) {
    super(date, coords, distance, duration);
    this.cadence = cadence;
    this._createID();
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = (this.duration / this.distance).toFixed(1);
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(date, coords, distance, duration, elevationGain) {
    super(date, coords, distance, duration);
    this.elevationGain = elevationGain;
    this._createID();
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = (this.distance / (this.duration / 60)).toFixed(1);
    return this.speed;
  }
}

// const run1 = new Running([27, 12], 2, 10, 33);
// console.log(run1);
// console.log(run1.calcPace());

/////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  #map;
  #mapZoomLvl = 13;
  #mapEvent;
  #workouts = [];
  #workoutEl;
  #clickedWorkout;
  #index;
  #isSorted = false;
  #add = true;
  #edit = false;

  constructor() {
    this._getPosition();

    this._getLocalStorage();

    form.addEventListener('submit', this._newWorkout.bind(this));

    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));

    containerWorkouts.addEventListener(
      'click',
      this._deleteAllWorkouts.bind(this)
    );

    containerWorkouts.addEventListener('click', this._sortWorkouts.bind(this));

    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
  }

  _getPosition() {
    // Get position of user
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLvl);
    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map for new workouts
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => this._renderWorkoutMarker(work));
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // prettier-ignore
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    // Switching cadence/elevation fields according to workout type
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();
    const validateInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const positiveInputs = (...inputs) => inputs.every(inp => inp > 0);

    const displayMessage = function () {
      form.style.height = '11.25rem';
      invalidMessage.classList.add('show__message');

      setTimeout(() => {
        form.style.height = '9.25rem';
        invalidMessage.classList.remove('show__message');
      }, 4000);
    };

    // Get data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let workout;

    // If form is opened for adding a new workout
    if (this.#add) {
      // If workout runnning, create running object
      const { lat, lng } = this.#mapEvent.latlng;
      if (type === 'running') {
        const cadence = +inputCadence.value;

        // Validate data0.\

        if (
          !validateInputs(distance, duration, cadence) ||
          !positiveInputs(distance, duration, cadence)
        ) {
          return displayMessage();
        }

        workout = new Running(
          new Date(),
          [lat, lng],
          distance,
          duration,
          cadence
        );
      }

      // If workout cycling, create cycling object
      if (type === 'cycling') {
        const elevationGain = +inputElevation.value;

        // Validate data
        if (
          !validateInputs(distance, duration, elevationGain) ||
          !positiveInputs(distance, duration)
        ) {
          return displayMessage();
        }

        workout = new Cycling(
          new Date(),
          [lat, lng],
          distance,
          duration,
          elevationGain
        );
      }

      // Add new object to workout array
      this.#workouts.push(workout);

      // render the workout on map
      this._renderWorkoutMarker(workout);

      // Render the workout list
      this._renderWorkout(workout);
    }

    // If form is opened for editing an existing workout
    if (this.#edit) {
      if (type === 'running') {
        const cadence = +inputCadence.value;

        // Validate data
        if (
          !validateInputs(distance, duration, cadence) ||
          !positiveInputs(distance, duration, cadence)
        ) {
          return displayMessage();
        }
        workout = new Running(
          this.#clickedWorkout.date,
          this.#clickedWorkout.coords,
          distance,
          duration,
          cadence
        );
      }

      if (type === 'cycling') {
        const elevationGain = +inputElevation.value;

        // Validate data
        if (
          !validateInputs(distance, duration, elevationGain) ||
          !positiveInputs(distance, duration)
        ) {
          return displayMessage();
        }

        workout = new Cycling(
          this.#clickedWorkout.date,
          this.#clickedWorkout.coords,
          distance,
          duration,
          elevationGain
        );
      }

      this.#workouts[this.#index] = workout;
    }

    // hide form after submit
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    location.reload();
  }

  _renderWorkoutMarker(workout) {
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 50,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        workout.type === 'running'
          ? `🏃 ${workout.description}`
          : `🚴 ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
      <div class="btn_container">
        <svg>
          <use href="icons.svg#icon-sort"></use>
        </svg>
      <button class="delete-all">
        <svg>
          <use href="icons.svg#icon-delete-all"></use>
        </svg>
      </button>
      </div>
          
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃' : '🚴'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>`;

    if (workout.type === 'running')
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace}</span>
       <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>`;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li> -->`;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    this.#workoutEl = e.target.closest('.workout');

    if (
      e.target.classList.contains('dropbtn') ||
      e.target.classList.contains('hover')
    )
      return;

    if (!this.#workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === this.#workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLvl, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    // this.#workouts = data;

    // For recreating the object
    this.#workouts = data.map(work => {
      if (work.type === 'running') {
        return new Running(
          new Date(work.date),
          work.coords,
          work.distance,
          work.duration,
          work.cadence
        );
      }

      if (work.type === 'cycling') {
        return new Cycling(
          new Date(work.date),
          work.coords,
          work.distance,
          work.duration,
          work.elevationGain
        );
      }
    });

    this.#workouts.forEach(work => this._renderWorkout(work));
  }

  _updateLocalStorage() {
    localStorage.removeItem('workouts');
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    location.reload();
  }

  _editWorkout(e) {
    // Handles reopening the form with previous values
    // Rest in new workout
    if (e.target.classList.contains('edit')) {
      this.#add = false;
      this.#edit = true;

      this.#clickedWorkout = this.#workouts.find(
        work => work.id === this.#workoutEl.dataset.id
      );

      this.#index = this.#workouts.indexOf(this.#clickedWorkout);

      // Handling running workouts
      if (this.#clickedWorkout.type === 'running') {
        inputType.value = this.#clickedWorkout.type;
        inputDistance.value = this.#clickedWorkout.distance;
        inputDuration.value = this.#clickedWorkout.duration;
        inputCadence.value = this.#clickedWorkout.cadence;
      }

      // Handling cycling workouts
      if (this.#clickedWorkout.type === 'cycling') {
        document
          .querySelector('.form__input--cadence')
          .closest('.form__row')
          .classList.add('form__row--hidden');
        document

          .querySelector('.form__input--elevation')
          .closest('.form__row')
          .classList.remove('form__row--hidden');

        inputType.value = this.#clickedWorkout.type;
        inputDistance.value = this.#clickedWorkout.distance;
        inputDuration.value = this.#clickedWorkout.duration;
        inputElevation.value = this.#clickedWorkout.elevationGain;
      }
      this._showForm();
    }
  }

  _deleteWorkout(e) {
    // this.#workoutEl = e.target.closest('.workout');
    if (e.target.classList.contains('delete')) {
      const clickedWorkout = this.#workouts.find(
        work => work.id === this.#workoutEl.dataset.id
      );
      const index = this.#workouts.indexOf(clickedWorkout);
      this.#workouts.splice(index, 1);

      // Delete workouts from local storage
      this._updateLocalStorage();
    }
  }

  _deleteAllWorkouts(e) {
    if (e.target.classList.contains('delete__all')) {
      this.#workouts = [];

      // Delete workouts from local storage
      this._updateLocalStorage();
    }
  }

  _removeElementsByClass(className) {
    // For updating workouts list on sort
    const elements = document.getElementsByClassName(className);
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0]);
    }
  }

  _sortWorkouts(e) {
    const sortedWorkouts = this.#workouts
      .slice(0)
      .sort((a, b) => a.distance - b.distance);

    const works = this.#isSorted ? this.#workouts : sortedWorkouts;

    if (e.target.classList.contains('sort')) {
      this._removeElementsByClass('workout');
      works.forEach(work => this._renderWorkout(work));
      this.#isSorted = !this.#isSorted;
    }
    console.log(this.#add, this.#edit, this.#workouts);
  }

  // reset() {
  //   localStorage.removeItem('workouts');
  //   location.reload();
  // }
}

const app = new App();

/*
      <div class="dropdown">
        <button class="dropbtn">&hellip;</button>
        <div class="dropdown--content">
          <a class="hover edit">Edit</a>
          <a class="hover delete">Delete</a>
          <a class="hover delete__all">Delete All</a>
          <a class="hover sort">Sort</a>
        </div>
      </div> */