import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { memberService } from '@/features/members/services/member.service';
import type {
  ListMembersParams,
  Member,
  MemberRequest,
} from '@/features/members/types/member.types';
import type { RootState } from '@/redux/store';
import { RequestStatus } from '@/types/common';
import { getApiErrorMessage } from '@/utils/apiError';

interface MembersState {
  items: Member[];
  total: number;
  status: RequestStatus;
  error: string | null;
  mutationStatus: RequestStatus;
  mutationError: string | null;
}

const initialState: MembersState = {
  items: [],
  total: 0,
  status: RequestStatus.IDLE,
  error: null,
  mutationStatus: RequestStatus.IDLE,
  mutationError: null,
};

export const fetchMembers = createAsyncThunk<
  { items: Member[]; total: number },
  ListMembersParams,
  { rejectValue: string }
>('members/fetchMembers', async (params, { rejectWithValue }) => {
  try {
    return await memberService.list(params);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to load members.'));
  }
});

export const createMember = createAsyncThunk<Member, MemberRequest, { rejectValue: string }>(
  'members/createMember',
  async (payload, { rejectWithValue }) => {
    try {
      return await memberService.create(payload);
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to create the member.'));
    }
  },
);

export const updateMember = createAsyncThunk<
  Member,
  { memberId: string; payload: MemberRequest },
  { rejectValue: string }
>('members/updateMember', async ({ memberId, payload }, { rejectWithValue }) => {
  try {
    return await memberService.update(memberId, payload);
  } catch (error) {
    return rejectWithValue(getApiErrorMessage(error, 'Unable to update the member.'));
  }
});

export const deleteMember = createAsyncThunk<string, string, { rejectValue: string }>(
  'members/deleteMember',
  async (memberId, { rejectWithValue }) => {
    try {
      await memberService.remove(memberId);
      return memberId;
    } catch (error) {
      return rejectWithValue(getApiErrorMessage(error, 'Unable to delete the member.'));
    }
  },
);

const membersSlice = createSlice({
  name: 'members',
  initialState,
  reducers: {
    resetMutationStatus(state) {
      state.mutationStatus = RequestStatus.IDLE;
      state.mutationError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMembers.pending, (state) => {
        state.status = RequestStatus.LOADING;
        state.error = null;
      })
      .addCase(fetchMembers.fulfilled, (state, action) => {
        state.status = RequestStatus.SUCCEEDED;
        state.items = action.payload.items;
        state.total = action.payload.total;
      })
      .addCase(fetchMembers.rejected, (state, action) => {
        state.status = RequestStatus.FAILED;
        state.error = action.payload ?? 'Unable to load members.';
      })
      .addCase(createMember.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(createMember.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(createMember.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to create the member.';
      })
      .addCase(updateMember.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(updateMember.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(updateMember.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to update the member.';
      })
      .addCase(deleteMember.pending, (state) => {
        state.mutationStatus = RequestStatus.LOADING;
        state.mutationError = null;
      })
      .addCase(deleteMember.fulfilled, (state) => {
        state.mutationStatus = RequestStatus.SUCCEEDED;
      })
      .addCase(deleteMember.rejected, (state, action) => {
        state.mutationStatus = RequestStatus.FAILED;
        state.mutationError = action.payload ?? 'Unable to delete the member.';
      });
  },
});

export const { resetMutationStatus } = membersSlice.actions;
export default membersSlice.reducer;

export const selectMembers = (state: RootState): Member[] => state.members.items;
export const selectMembersTotal = (state: RootState): number => state.members.total;
export const selectMembersStatus = (state: RootState): RequestStatus => state.members.status;
export const selectMembersError = (state: RootState): string | null => state.members.error;
export const selectMembersMutationStatus = (state: RootState): RequestStatus =>
  state.members.mutationStatus;
export const selectMembersMutationError = (state: RootState): string | null =>
  state.members.mutationError;
