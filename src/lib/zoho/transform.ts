export function transformZohoCandidate(zohoData: Record<string, any>) {
  return {
    id: zohoData.id,
    full_name: zohoData.Full_Name,
    email: zohoData.Email,
    phone: zohoData.Phone,
    current_status: zohoData.Candidate_Status,
    candidate_stage: zohoData.Candidate_Stage,
    job_opening_id: zohoData.Job_Opening?.id,
    job_opening_title: zohoData.Job_Opening?.name,
    owner: zohoData.Candidate_Owner?.name,
    source: zohoData.Source,
    nationality: zohoData.Nationality,
    native_language: zohoData.Native_Language,
    english_level: zohoData.English_Level || zohoData['Nivel de Alemán'],
    german_level: zohoData.German_Level,
    work_permit: zohoData.Work_Permit,
    created_time: zohoData.Created_Time,
    modified_time: zohoData.Modified_Time,
    last_activity_time: zohoData.Modified_Time,
  }
}

export function extractStatusChange(
  data: Record<string, any>,
  previousData: Record<string, any> | null | undefined,
) {
  return {
    from_status: previousData?.Candidate_Status || null,
    to_status: data.Candidate_Status,
    changed_at: data.Modified_Time,
  }
}
