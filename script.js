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
const sidebar = document.querySelector('.sidebar');
const sort = document.querySelector('.sort');

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

/////////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  #map;
  #mapZoomLvl = 13;
  #mapEvent;
  #workouts = [];
  #markers = []; // Array for saving markers on map
  #workoutEl; // Workout element that was clicked
  #clickedWorkout; // Workout that was clicked
  #index; // Index of clicked workout
  #editEl; // Workout element that is being edited
  #add = true; // When form is for a new workout
  #edit = false; // When form is for editing an existing workout

  constructor() {
    this._getPosition();

    this._getLocalStorage();

    // Submitting workout form
    form.addEventListener('submit', this._newWorkout.bind(this));

    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));

    containerWorkouts.addEventListener(
      'click',
      this._deleteAllWorkouts.bind(this)
    );

    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    this._renderBtns();

    containerWorkouts.addEventListener(
      'click',
      this._displaySortOptions.bind(this)
    );

    containerWorkouts.addEventListener('click', this._sortWorkouts.bind(this));

    // Hide sort options when clicked somewhere else
    sidebar.addEventListener('click', this._hideSortOptions);
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
    form.style.display = 'grid';
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
  }

  _toggleElevationField() {
    // Switching cadence/elevation fields according to workout type
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    e.preventDefault();
    // Input validation
    const validateInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const positiveInputs = (...inputs) => inputs.every(inp => inp > 0);

    // Invalid inputs message
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

        // Validate data
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

      // Changing the edited workout
      this.#workouts[this.#index] = workout;
    }

    // hide form after submition
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    // Updating the workout in rendered list, if it was an edit
    if (this.#edit) this._updateRenderedWorkout(workout);

    // Rendering the overview buttons if its first workout
    this._renderBtns();
  }

  // Re-rendering the edited workout with new data
  _updateRenderedWorkout(workout) {
    const newMarkup = this._generateMarkup(workout);
    const newDom = document.createRange().createContextualFragment(newMarkup);
    containerWorkouts.replaceChild(newDom, this.#editEl);

    // Resetting form to a new workout
    this.#edit = false;
    this.#add = true;
  }

  // Rendering a workout marker on the map with popup content
  _renderWorkoutMarker(workout) {
    let marker = L.marker(workout.coords)
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

    // Saving the marker to markers array
    this.#markers.push(marker);
  }

  // Rendering/Removing overview buttons
  _renderBtns() {
    const markup = `
            <div class="overview_container">
                <button class="btn sort">Sort</button>
                <div class="options">
                  <button class="btn btn_sort distance">Distance</button>
                  <button class="btn btn_sort duration">Duration</button>
                  <button class="btn btn_sort time">Time</button>
                </div>
              <button class="btn delete_all">Delete All</button>
            </div>
    `;
    const overviewElement = document.querySelector('.overview_container');

    if (this.#workouts.length && !overviewElement)
      containerWorkouts.insertAdjacentHTML('afterbegin', markup);

    // Removing overview if it exists and there are no workouts
    if (!this.#workouts.length && overviewElement)
      containerWorkouts.removeChild(overviewElement);
  }

  // Creating markup for workout
  _generateMarkup(workout) {
    let html = `
    <li
      class="workout workout--${workout.type}"
      data-id="${workout.id}"
    >
      <h2 class="workout__title">${workout.description}</h2>
      <div class="individual_container">
        <button class="btn edit">Edit</button>
        <button class="btn delete">Delete</button>
      </div>

      <div class="workout__details">
        <span class="workout__icon"
          >${workout.type === 'running' ? '🏃' : '🚴'}</span
        >
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
    </li>`;

    return html;
  }

  // Rendering workout
  _renderWorkout(workout) {
    form.insertAdjacentHTML('afterend', this._generateMarkup(workout));
  }

  // Moving to workout marker on map upon workout click
  _moveToPopup(e) {
    // Getting the clicked workout element
    this.#workoutEl = e.target.closest('.workout');

    if (!this.#workoutEl) return;

    // Getting the clicked workout
    const workout = this.#workouts.find(
      work => work.id === this.#workoutEl.dataset.id
    );

    // Setting the view to clicked workout marker
    this.#map.setView(workout.coords, this.#mapZoomLvl, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  // Saving the workouts to local storage
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  // Getting the workouts from local storage
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    // Original version, does not re-create the workouts
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

    // Rendering the workouts from local storage
    this.#workouts.forEach(work => this._renderWorkout(work));
  }

  // Updating the local storage with new workouts
  _updateLocalStorage() {
    localStorage.removeItem('workouts');
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _editWorkout(e) {
    // Handles reopening the form with previous values
    // Rest in new workout
    const btn = e.target.closest('.edit');
    if (!btn) return;

    // Setting the workout form to edit mode
    this.#add = false;
    this.#edit = true;

    // Saving the clicked element to new property as the old one will be reassigned when form is submited, to null
    this.#editEl = this.#workoutEl;

    // Finding out the workout that was clicked
    this.#clickedWorkout = this.#workouts.find(
      work => work.id === this.#editEl.dataset.id
    );

    this.#index = this.#workouts.indexOf(this.#clickedWorkout);

    // Handling running workouts
    if (this.#clickedWorkout.type === 'running') {
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');

      inputElevation.closest('.form__row').classList.add('form__row--hidden');

      inputType.value = this.#clickedWorkout.type;
      inputDistance.value = this.#clickedWorkout.distance;
      inputDuration.value = this.#clickedWorkout.duration;
      inputCadence.value = this.#clickedWorkout.cadence;
    }

    // Handling cycling workouts
    if (this.#clickedWorkout.type === 'cycling') {
      inputCadence.closest('.form__row').classList.add('form__row--hidden');

      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');

      inputType.value = this.#clickedWorkout.type;
      inputDistance.value = this.#clickedWorkout.distance;
      inputDuration.value = this.#clickedWorkout.duration;
      inputElevation.value = this.#clickedWorkout.elevationGain;
    }

    // Open the form for editing with original values
    this._showForm();
  }

  _deleteWorkout(e) {
    if (e.target.closest('.delete')) {
      const clickedWorkout = this.#workouts.find(
        work => work.id === this.#workoutEl.dataset.id
      );
      const index = this.#workouts.indexOf(clickedWorkout);
      this.#workouts.splice(index, 1);

      // Update workouts in the local storage
      this._updateLocalStorage();

      // Removing the deleted workout from rendered list
      e.target.closest('.workouts').removeChild(this.#workoutEl);

      // Removing the deleted workout marker from map
      this.#markers[index].remove();
      this.#markers.splice(index, 1);
    }
    this._renderBtns();
  }

  _deleteAllWorkouts(e) {
    if (e.target.classList.contains('delete_all')) {
      this.#workouts = [];
      this._removeElementsByClass('workout');
      this.#markers.forEach(marker => marker.remove());
      this._renderBtns();

      // Delete workouts from local storage
      this._updateLocalStorage();
    }
  }

  _displaySortOptions(e) {
    const btn = e.target.closest('.sort');
    if (btn) document.querySelector('.options').classList.toggle('show');
  }

  _hideSortOptions(e) {
    if (!e.target.closest('.btn_sort') && !e.target.closest('.sort')) {
      document.querySelector('.options')?.classList.remove('show');
    }
  }

  _removeElementsByClass(className) {
    // For clearing all rendered workouts, for sort or delete all
    const elements = document.getElementsByClassName(className);
    while (elements.length > 0) {
      elements[0].parentNode.removeChild(elements[0]);
    }
  }

  _sortWorkouts(e) {
    const sortedDistance = this.#workouts
      .slice(0)
      .sort((a, b) => a.distance - b.distance);

    const sortedDuration = this.#workouts
      .slice(0)
      .sort((a, b) => a.duration - b.duration);

    if (e.target?.classList.contains('distance')) {
      this._removeElementsByClass('workout');
      sortedDistance.forEach(work => this._renderWorkout(work));
    }
    if (e.target?.classList.contains('duration')) {
      this._removeElementsByClass('workout');
      sortedDuration.forEach(work => this._renderWorkout(work));
    }
    if (e.target?.classList.contains('time')) {
      this._removeElementsByClass('workout');
      this.#workouts.forEach(work => this._renderWorkout(work));
    }
  }

  // Developer purpose only
  // reset() {
  //   localStorage.removeItem('workouts');
  //   location.reload();
  // }
}

const app = new App();
// app.reset();
