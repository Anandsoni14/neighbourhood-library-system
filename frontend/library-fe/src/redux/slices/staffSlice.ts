import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { staffService } from '@/features/staff/services/staff.service';
import type {
  ListStaffParams,
  Staff,
  StaffCreateRequest,
  StaffUpdateRequest,
} from '@/features/staff/types/staff.types';
import type { RootState } from '@/redux/store';
import { RequestStatus } from '@/types/common';
import { getApiErrorMessage } from '@/utils/apiError';

interface StaffState {
  items: Staff[];
  total: number;
  status: RequestStatus;
  error: string | null;
  mutationStatus: RequestStatus;
  mutationError: string | null;
  /** See booksSlice's identical field for the stale-response rationale. */
  latestRequestId: string | null;
}

const initialState: StaffState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
  latestRequestId: null,
};

export const fetchStaff = createAsyncThunk<
  { items: Staff[]; total: number },
  ListStaffParams,
  { rejectValue: string }
>('staff/fetchStaff', async (params, { rejectWithValue }) => {
  try {
    return await staffService.list(params);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load staff.'));
  }
});

export const createStaff = createAsyncThunk<Staff, StaffCreateRequest, { rejectValue: string }>(
  'staff/createStaff',
  async (payload, { rejectWithValue }) => {
    try {
      return await staffService.create(payload);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to create the staff member.'));
    }
  },
);

export const updateStaff = createAsyncThunk<
  Staff,
  { staffId: string; payload: StaffUpdateRequest },
  { rejectValue: string }
>('staff/updateStaff', async ({ staffId, payload }, { rejectWithValue }) => {
  try {
    return await staffService.update(staffId, payload);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to update the staff member.'));
  }
});

export const activateStaff = createAsyncThunk<Staff, string, { rejectValue: string }>(
  'staff/activateStaff',
  async (staffId, { rejectWithValue }) => {
    try {
      return await staffService.activate(staffId);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to activate the staff member.'));
    }
  },
);

export const deactivateStaff = createAsyncThunk<Staff, string, { rejectValue: string }>(
  'staff/deactivateStaff',
  async (staffId, { rejectWithValue }) => {
    try {
      return await staffService.deactivate(staffId);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to deactivate the staff member.'));
    }
  },
);

const staffSlice = createSlice({
  name: 'staff',
  initialState,
  reducers: {
    resetMutationStatus(state) {
      state.mutationStatus = RequestStatus.IDLE;
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStaff.pending, (state, action) => {
        state.status = RequestStatus.LOADING;
        state.error = null;
        state.latestRequestId = action.meta.requestId;
      })
      .addCase(fetchStaff.fulfilled, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.SUCCEEDED;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchStaff.rejected, (state, action) => {
        if (action.meta.requestId !== state.latestRequestId) {
          return;
        }
        state.status = RequestStatus.FAILED;
        state.error = action.payload ?? 'Unable to load staff.';
      })
      .addCase(createStaff.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(createStaff.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(createStaff.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to create the staff member.';
      })
      .addCase(updateStaff.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(updateStaff.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(updateStaff.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to update the staff member.';
      })
      .addCase(activateStaff.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(activateStaff.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(activateStaff.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to activate the staff member.';
      })
      .addCase(deactivateStaff.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(deactivateStaff.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(deactivateStaff.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to deactivate the staff member.';
      });
  },
});

export const { resetMutationStatus } = staffSlice.actions;
export default staffSlice.reducer;

export const selectStaff = (state: RootState): Staff[] => state.staff.items;
export const selectStaffTotal = (state: RootState): number => state.staff.total;
export const selectStaffStatus = (state: RootState): RequestStatus => state.staff.status;
export const selectStaffError = (state: RootState): string | null => state.staff.error;
export const selectStaffMutationStatus = (state: RootState): RequestStatus =>
  state.staff.mutationStatus;
export const selectStaffMutationError = (state: RootState): string | null =>
  state.staff.mutationError;
